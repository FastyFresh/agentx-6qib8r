#!/bin/bash
set -euo pipefail

# AWS CLI v2.0+ required for KMS encryption and CloudWatch metrics
# PostgreSQL Client v15 required for parallel dump support

# Global Variables
BACKUP_BUCKET="agent-platform-${ENVIRONMENT}-backups"
BACKUP_PATH="backups/$(date +%Y-%m-%d)"
RETENTION_DAYS=30
DB_HOST="${RDS_ENDPOINT}"
DB_NAME="agent_platform_${ENVIRONMENT}"
COMPRESSION_LEVEL=5
MAX_PARALLEL_JOBS=4
KMS_KEY_ID="${AWS_KMS_KEY_ID}"
SECONDARY_REGION="${AWS_SECONDARY_REGION}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DIR="/tmp/db_backup_${TIMESTAMP}"
LOG_FILE="/var/log/agent-platform/backups.log"

# Check all prerequisites before starting backup
check_prerequisites() {
    local status=0

    # Check AWS CLI version
    if ! aws --version | grep -q "aws-cli/2"; then
        echo "ERROR: AWS CLI v2.0+ is required"
        status=1
    fi

    # Verify PostgreSQL client version
    if ! pg_dump --version | grep -q "PostgreSQL 15"; then
        echo "ERROR: PostgreSQL client 15 is required"
        status=1
    fi

    # Validate required environment variables
    for var in ENVIRONMENT RDS_ENDPOINT AWS_KMS_KEY_ID AWS_SECONDARY_REGION; do
        if [[ -z "${!var:-}" ]]; then
            echo "ERROR: Required environment variable $var is not set"
            status=1
        fi
    done

    # Check AWS connectivity
    if ! aws s3 ls "s3://${BACKUP_BUCKET}" >/dev/null 2>&1; then
        echo "ERROR: Cannot access S3 bucket ${BACKUP_BUCKET}"
        status=1
    fi

    # Verify KMS key access
    if ! aws kms describe-key --key-id "${KMS_KEY_ID}" >/dev/null 2>&1; then
        echo "ERROR: Cannot access KMS key ${KMS_KEY_ID}"
        status=1
    fi

    # Check available disk space (need at least 20GB free)
    if [[ $(df -BG /tmp | awk 'NR==2 {print $4}' | tr -d 'G') -lt 20 ]]; then
        echo "ERROR: Insufficient disk space in /tmp (need at least 20GB)"
        status=1
    fi

    return $status
}

# Main backup function
backup_database() {
    local backup_type=$1
    local compression_level=$2
    local parallel_jobs=$3
    local start_time=$(date +%s)
    local backup_file="${TEMP_DIR}/${DB_NAME}_${backup_type}_${TIMESTAMP}.sql"
    local status=0

    # Create temp directory with cleanup trap
    mkdir -p "${TEMP_DIR}"
    trap 'rm -rf "${TEMP_DIR}"' EXIT

    echo "Starting ${backup_type} backup of ${DB_NAME} at $(date)"

    # Execute parallel pg_dump with compression
    if ! PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "${DB_HOST}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -j "${parallel_jobs}" \
        -F directory \
        -Z "${compression_level}" \
        -f "${backup_file}"; then
        log_backup_status "${backup_type}" "error" "pg_dump failed" "{}"
        return 1
    fi

    # Generate SHA-256 checksum
    local checksum=$(find "${backup_file}" -type f -exec sha256sum {} \; | sort -k 2 | sha256sum | cut -d' ' -f1)
    echo "${checksum}" > "${backup_file}.sha256"

    # Upload to S3 with KMS encryption
    if ! aws s3 cp \
        "${backup_file}" \
        "s3://${BACKUP_BUCKET}/${BACKUP_PATH}/${DB_NAME}_${backup_type}_${TIMESTAMP}.sql" \
        --sse aws:kms \
        --sse-kms-key-id "${KMS_KEY_ID}" \
        --metadata "checksum=${checksum}"; then
        log_backup_status "${backup_type}" "error" "S3 upload failed" "{}"
        return 1
    fi

    # Initiate cross-region replication
    aws s3api copy-object \
        --copy-source "${BACKUP_BUCKET}/${BACKUP_PATH}/${DB_NAME}_${backup_type}_${TIMESTAMP}.sql" \
        --bucket "${BACKUP_BUCKET}-${SECONDARY_REGION}" \
        --key "${BACKUP_PATH}/${DB_NAME}_${backup_type}_${TIMESTAMP}.sql" \
        --source-region "${AWS_DEFAULT_REGION}" \
        --region "${SECONDARY_REGION}"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local size=$(du -sb "${backup_file}" | cut -f1)

    log_backup_status "${backup_type}" "success" "Backup completed" \
        "{\"duration\":${duration},\"size\":${size},\"checksum\":\"${checksum}\"}"

    return $status
}

# Cleanup old backups
cleanup_old_backups() {
    local cutoff_date=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
    local status=0

    echo "Cleaning up backups older than ${cutoff_date}"

    # Delete old backups in primary region
    aws s3 rm \
        "s3://${BACKUP_BUCKET}/backups/" \
        --recursive \
        --exclude "*" \
        --include "*/????-??-??/*" \
        --region "${AWS_DEFAULT_REGION}" \
        --exclude "*${cutoff_date}*" \
        --exclude "*${cutoff_date}*/*"

    # Delete old backups in secondary region
    aws s3 rm \
        "s3://${BACKUP_BUCKET}-${SECONDARY_REGION}/backups/" \
        --recursive \
        --exclude "*" \
        --include "*/????-??-??/*" \
        --region "${SECONDARY_REGION}" \
        --exclude "*${cutoff_date}*" \
        --exclude "*${cutoff_date}*/*"

    log_backup_status "cleanup" "success" "Cleanup completed" \
        "{\"retention_days\":${RETENTION_DAYS},\"cutoff_date\":\"${cutoff_date}\"}"

    return $status
}

# Log backup status to CloudWatch
log_backup_status() {
    local backup_type=$1
    local status=$2
    local message=$3
    local metrics=$4

    # Create JSON log entry
    local log_entry=$(cat <<EOF
{
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "backup_type": "${backup_type}",
    "status": "${status}",
    "message": "${message}",
    "metrics": ${metrics}
}
EOF
)

    # Send to CloudWatch
    aws logs put-log-events \
        --log-group-name "/agent-platform/${ENVIRONMENT}/backups" \
        --log-stream-name "${TIMESTAMP}" \
        --log-events "[{\"timestamp\": $(date +%s)000, \"message\": ${log_entry}}]"

    # Write to local log file
    echo "${log_entry}" >> "${LOG_FILE}"
}

# Main execution
main() {
    if ! check_prerequisites; then
        echo "Prerequisites check failed. Exiting."
        exit 1
    fi

    # Determine backup type based on hour
    local hour=$(date +%H)
    local backup_type="incremental"
    
    if [[ $hour == "00" ]]; then
        backup_type="full"
    fi

    if ! backup_database "${backup_type}" "${COMPRESSION_LEVEL}" "${MAX_PARALLEL_JOBS}"; then
        echo "Backup failed. Check logs for details."
        exit 1
    fi

    if [[ $hour == "00" ]]; then
        if ! cleanup_old_backups; then
            echo "Cleanup failed. Check logs for details."
            exit 1
        fi
    fi
}

# Execute main function
main
#!/usr/bin/env bash

# AGENT AI Platform Deployment Script
# Version: 1.0.0
# Description: Advanced deployment script for multi-region Kubernetes deployments
# with progressive rollout, health verification, and intelligent rollback capabilities

set -euo pipefail

# Global Constants
readonly CHART_PATH="infrastructure/helm/agent-platform"
readonly RELEASE_NAME="agent-platform"
readonly TIMEOUT="10m"
readonly MAX_HISTORY="10"
readonly CANARY_WEIGHT="20"
readonly PROGRESSIVE_DELAY="30s"
readonly HEALTH_CHECK_RETRIES="5"
readonly BACKUP_RETENTION="7d"

# Required tool versions
readonly REQUIRED_HELM_VERSION="3.0.0"
readonly REQUIRED_KUBECTL_VERSION="1.27.0"
readonly REQUIRED_AWS_CLI_VERSION="2.0.0"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Log levels
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate all prerequisites and configurations
validate_prerequisites() {
    log_info "Validating deployment prerequisites..."
    
    # Verify required tools
    if ! command -v helm >/dev/null 2>&1 || \
       ! command -v kubectl >/dev/null 2>&1 || \
       ! command -v aws >/dev/null 2>&1; then
        log_error "Required tools (helm, kubectl, aws) not found"
        return 1
    }

    # Verify tool versions
    local helm_version=$(helm version --template='{{.Version}}' | cut -d'v' -f2)
    local kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion' | cut -d'v' -f2)
    local aws_version=$(aws --version 2>&1 | cut -d'/' -f2 | cut -d' ' -f1)

    if [[ "${helm_version}" < "${REQUIRED_HELM_VERSION}" ]] || \
       [[ "${kubectl_version}" < "${REQUIRED_KUBECTL_VERSION}" ]] || \
       [[ "${aws_version}" < "${REQUIRED_AWS_CLI_VERSION}" ]]; then
        log_error "Tool version requirements not met"
        return 1
    }

    # Verify Helm chart and values
    if [[ ! -d "${CHART_PATH}" ]]; then
        log_error "Helm chart not found at ${CHART_PATH}"
        return 1
    }

    # Validate cluster connectivity
    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    }

    # Verify AWS authentication
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS authentication failed"
        return 1
    }

    # Verify Helm repositories
    helm repo update &>/dev/null || {
        log_error "Failed to update Helm repositories"
        return 1
    }

    return 0
}

# Deploy to a specific environment
deploy_environment() {
    local environment=$1
    local namespace=$2
    local canary_enabled=${3:-false}
    local values_file="${CHART_PATH}/values-${environment}.yaml"
    
    log_info "Starting deployment to ${environment} environment in namespace ${namespace}"

    # Verify namespace exists or create it
    kubectl get namespace "${namespace}" &>/dev/null || {
        kubectl create namespace "${namespace}"
        log_info "Created namespace ${namespace}"
    }

    # Create backup before deployment
    create_backup "${namespace}" || {
        log_error "Failed to create backup"
        return 1
    }

    # Deploy with canary if enabled for production
    if [[ "${environment}" == "prod" && "${canary_enabled}" == "true" ]]; then
        deploy_canary "${namespace}" "${values_file}" || {
            log_error "Canary deployment failed"
            return 1
        }
    else
        # Standard deployment
        helm upgrade --install "${RELEASE_NAME}" "${CHART_PATH}" \
            --namespace "${namespace}" \
            --values "${values_file}" \
            --timeout "${TIMEOUT}" \
            --history-max "${MAX_HISTORY}" \
            --wait || {
            log_error "Helm deployment failed"
            return 1
        }
    fi

    # Verify deployment
    verify_deployment "${namespace}" || {
        log_error "Deployment verification failed"
        rollback_deployment "${RELEASE_NAME}" "${namespace}"
        return 1
    }

    log_info "Deployment to ${environment} completed successfully"
    return 0
}

# Deploy canary version
deploy_canary() {
    local namespace=$1
    local values_file=$2
    
    log_info "Starting canary deployment with ${CANARY_WEIGHT}% traffic"

    # Deploy canary version
    helm upgrade --install "${RELEASE_NAME}-canary" "${CHART_PATH}" \
        --namespace "${namespace}" \
        --values "${values_file}" \
        --set global.deployment.canary=true \
        --set global.deployment.weight="${CANARY_WEIGHT}" \
        --timeout "${TIMEOUT}" \
        --wait || return 1

    # Monitor canary health
    for i in $(seq 1 "${HEALTH_CHECK_RETRIES}"); do
        sleep "${PROGRESSIVE_DELAY}"
        if ! verify_deployment "${namespace}"; then
            log_error "Canary health check failed"
            return 1
        fi
        log_info "Canary health check ${i}/${HEALTH_CHECK_RETRIES} passed"
    done

    # Promote canary to production
    helm upgrade --install "${RELEASE_NAME}" "${CHART_PATH}" \
        --namespace "${namespace}" \
        --values "${values_file}" \
        --timeout "${TIMEOUT}" \
        --wait || return 1

    # Clean up canary
    helm uninstall "${RELEASE_NAME}-canary" --namespace "${namespace}" || true

    return 0
}

# Verify deployment health
verify_deployment() {
    local namespace=$1
    
    log_info "Verifying deployment health in namespace ${namespace}"

    # Check pod status
    kubectl get pods -n "${namespace}" -l "app.kubernetes.io/instance=${RELEASE_NAME}" \
        -o jsonpath='{.items[*].status.containerStatuses[*].ready}' | grep -q "false" && {
        log_error "Not all pods are ready"
        return 1
    }

    # Check service endpoints
    kubectl get endpoints -n "${namespace}" -l "app.kubernetes.io/instance=${RELEASE_NAME}" \
        -o jsonpath='{.items[*].subsets[*].addresses[*]}' | grep -q "ip" || {
        log_error "Service endpoints not available"
        return 1
    }

    # Verify Istio virtual services
    kubectl get virtualservices -n "${namespace}" -l "app.kubernetes.io/instance=${RELEASE_NAME}" \
        -o jsonpath='{.items[*].spec.hosts}' | grep -q "." || {
        log_error "Virtual services not configured"
        return 1
    }

    # Check metrics availability
    kubectl get servicemonitors -n "${namespace}" -l "app.kubernetes.io/instance=${RELEASE_NAME}" \
        -o jsonpath='{.items[*].spec.endpoints[*].port}' | grep -q "metrics" || {
        log_error "Metrics endpoints not configured"
        return 1
    }

    return 0
}

# Create backup before deployment
create_backup() {
    local namespace=$1
    
    log_info "Creating backup for namespace ${namespace}"

    # Backup Helm releases
    helm list -n "${namespace}" -o json > "backup-${namespace}-$(date +%Y%m%d_%H%M%S).json" || return 1

    # Backup Kubernetes resources
    kubectl get all -n "${namespace}" -o yaml > "backup-k8s-${namespace}-$(date +%Y%m%d_%H%M%S).yaml" || return 1

    return 0
}

# Rollback deployment
rollback_deployment() {
    local release_name=$1
    local namespace=$2
    
    log_info "Rolling back deployment ${release_name} in namespace ${namespace}"

    # Get last successful revision
    local last_successful_revision=$(helm history "${release_name}" -n "${namespace}" | grep "DEPLOYED" | tail -1 | awk '{print $1}')

    if [[ -n "${last_successful_revision}" ]]; then
        helm rollback "${release_name}" "${last_successful_revision}" -n "${namespace}" --wait || {
            log_error "Rollback failed"
            return 1
        }
        log_info "Rollback completed successfully"
        return 0
    else
        log_error "No successful revision found for rollback"
        return 1
    }
}

# Main execution
main() {
    local environment=${1:-}
    local namespace=${2:-}
    local canary=${3:-false}

    if [[ -z "${environment}" || -z "${namespace}" ]]; then
        log_error "Usage: $0 <environment> <namespace> [canary]"
        exit 1
    }

    # Validate prerequisites
    validate_prerequisites || exit 1

    # Execute deployment
    deploy_environment "${environment}" "${namespace}" "${canary}" || exit 1

    log_info "Deployment process completed successfully"
    exit 0
}

# Execute main function with provided arguments
main "$@"
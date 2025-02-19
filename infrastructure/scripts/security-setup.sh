#!/bin/bash

# security-setup.sh
# Comprehensive security configuration script for AGENT AI Platform
# Version: 1.0.0

# Strict error handling
set -euo pipefail
IFS=$'\n\t'

# Required package versions
readonly REQUIRED_AWS_CLI_VERSION="2.0.0"
readonly REQUIRED_KUBECTL_VERSION="1.27.0"
readonly REQUIRED_ISTIO_VERSION="1.18.0"

# Global variables
AWS_REGION=${AWS_REGION:-"us-east-1"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}
CLUSTER_NAME=${CLUSTER_NAME:-"agent-ai-cluster"}

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Version validation function
validate_version() {
    local tool=$1
    local required_version=$2
    local current_version=$3
    
    if [[ "$(printf '%s\n' "$required_version" "$current_version" | sort -V | head -n1)" != "$required_version" ]]; then
        log_error "$tool version $current_version is lower than required version $required_version"
        exit 1
    fi
}

# Prerequisite check
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    validate_version "AWS CLI" "$REQUIRED_AWS_CLI_VERSION" "$(aws --version | cut -d/ -f2 | cut -d' ' -f1)"

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    }
    validate_version "kubectl" "$REQUIRED_KUBECTL_VERSION" "$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion' | cut -d'v' -f2)"

    # Check istioctl
    if ! command -v istioctl &> /dev/null; then
        log_error "istioctl is not installed"
        exit 1
    }
    validate_version "istioctl" "$REQUIRED_ISTIO_VERSION" "$(istioctl version --remote=false | grep -oP 'version: \K[0-9]+\.[0-9]+\.[0-9]+')"

    log_info "All prerequisites satisfied"
}

# KMS encryption setup
setup_kms_encryption() {
    local environment=$1
    log_info "Setting up KMS encryption for environment: $environment"

    # Create KMS keys for different services
    aws kms create-key \
        --description "KMS key for RDS encryption - $environment" \
        --tags TagKey=Environment,TagValue="$environment" \
        --region "$AWS_REGION"

    aws kms create-key \
        --description "KMS key for ElastiCache encryption - $environment" \
        --tags TagKey=Environment,TagValue="$environment" \
        --region "$AWS_REGION"

    aws kms create-key \
        --description "KMS key for Secrets encryption - $environment" \
        --tags TagKey=Environment,TagValue="$environment" \
        --region "$AWS_REGION"

    # Enable automatic key rotation
    for key in $(aws kms list-keys --query 'Keys[*].KeyId' --output text); do
        aws kms enable-key-rotation --key-id "$key" --region "$AWS_REGION"
    done

    log_info "KMS encryption setup completed"
    return 0
}

# IAM roles configuration
configure_iam_roles() {
    local cluster_name=$1
    log_info "Configuring IAM roles for cluster: $cluster_name"

    # Create EKS cluster role
    aws iam create-role \
        --role-name "${cluster_name}-cluster-role" \
        --assume-role-policy-document file://cluster-trust-policy.json

    # Create node group role
    aws iam create-role \
        --role-name "${cluster_name}-node-role" \
        --assume-role-policy-document file://node-trust-policy.json

    # Attach required policies
    aws iam attach-role-policy \
        --role-name "${cluster_name}-cluster-role" \
        --policy-arn "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"

    aws iam attach-role-policy \
        --role-name "${cluster_name}-node-role" \
        --policy-arn "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"

    log_info "IAM roles configuration completed"
    return 0
}

# Network security setup
setup_network_security() {
    local vpc_id=$1
    log_info "Setting up network security for VPC: $vpc_id"

    # Configure WAF rules
    aws wafv2 create-web-acl \
        --name "${CLUSTER_NAME}-waf" \
        --scope REGIONAL \
        --default-action Block={} \
        --rules file://waf-rules.json \
        --region "$AWS_REGION"

    # Set up security groups
    aws ec2 create-security-group \
        --group-name "${CLUSTER_NAME}-sg" \
        --description "Security group for ${CLUSTER_NAME}" \
        --vpc-id "$vpc_id"

    # Enable VPC flow logs
    aws ec2 create-flow-logs \
        --resource-type VPC \
        --resource-ids "$vpc_id" \
        --traffic-type ALL \
        --log-destination-type cloud-watch-logs \
        --deliver-logs-permission-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:role/flow-logs-role"

    log_info "Network security setup completed"
    return 0
}

# Security monitoring setup
setup_monitoring() {
    local cluster_name=$1
    log_info "Setting up security monitoring for cluster: $cluster_name"

    # Deploy Prometheus for security metrics
    kubectl apply -f prometheus-security-config.yaml

    # Configure CloudWatch alerts
    aws cloudwatch put-metric-alarm \
        --alarm-name "${cluster_name}-security-alarm" \
        --metric-name SecurityEvents \
        --namespace AWS/EKS \
        --statistic Sum \
        --period 300 \
        --threshold 1 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 1 \
        --alarm-actions "arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:security-alerts"

    # Set up audit logging
    kubectl apply -f audit-policy.yaml

    log_info "Security monitoring setup completed"
    return 0
}

# Main security setup function
setup_security() {
    local vpc_id=$1
    log_info "Starting comprehensive security setup for AGENT AI Platform"

    # Check prerequisites
    check_prerequisites

    # Setup KMS encryption
    setup_kms_encryption "$ENVIRONMENT" || {
        log_error "KMS encryption setup failed"
        exit 1
    }

    # Configure IAM roles
    configure_iam_roles "$CLUSTER_NAME" || {
        log_error "IAM roles configuration failed"
        exit 1
    }

    # Setup network security
    setup_network_security "$vpc_id" || {
        log_error "Network security setup failed"
        exit 1
    }

    # Setup security monitoring
    setup_monitoring "$CLUSTER_NAME" || {
        log_error "Security monitoring setup failed"
        exit 1
    }

    log_info "Security setup completed successfully"
    return 0
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -ne 1 ]]; then
        log_error "Usage: $0 <vpc-id>"
        exit 1
    fi

    vpc_id=$1
    setup_security "$vpc_id"
fi
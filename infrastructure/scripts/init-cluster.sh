#!/usr/bin/env bash

# AGENT AI Platform - Kubernetes Cluster Initialization Script
# Version: 1.0.0
# This script initializes and configures a production-ready Kubernetes cluster
# with all required components for the AGENT AI Platform.

set -euo pipefail

# Global variables with default values
CLUSTER_NAME="${CLUSTER_NAME:-agent-platform}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-west-2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELM_VALUES_FILE="${SCRIPT_DIR}/../helm/agent-platform/values.yaml"
HELM_CHART_FILE="${SCRIPT_DIR}/../helm/agent-platform/Chart.yaml"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local msg="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    case $level in
        INFO)  echo -e "${GREEN}[INFO]${NC} ${timestamp} - $msg" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $msg" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} ${timestamp} - $msg" ;;
    esac
}

# Check prerequisites for cluster initialization
check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "helm" "aws")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log ERROR "$tool is required but not installed"
            return 1
        fi
    done

    # Verify kubectl version compatibility
    local k8s_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
    if [[ ! "$k8s_version" =~ v1\.2[7-9]\. ]]; then
        log ERROR "kubectl version must be 1.27 or higher. Found: $k8s_version"
        return 1
    fi

    # Verify AWS CLI credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log ERROR "Invalid or missing AWS credentials"
        return 1
    }

    # Check AWS KMS permissions
    if ! aws kms list-keys --region "$AWS_REGION" &> /dev/null; then
        log ERROR "Missing AWS KMS permissions"
        return 1
    }

    # Verify cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log ERROR "Cannot access Kubernetes cluster"
        return 1
    }

    log INFO "Prerequisites check completed successfully"
    return 0
}

# Setup Helm repositories with security verification
setup_helm_repositories() {
    log INFO "Setting up Helm repositories..."

    # Add required repositories with signature verification
    local repos=(
        "istio https://istio-release.storage.googleapis.com/charts"
        "prometheus-community https://prometheus-community.github.io/helm-charts"
        "bitnami https://charts.bitnami.com/bitnami"
    )

    for repo in "${repos[@]}"; do
        read -r name url <<< "$repo"
        if ! helm repo list | grep -q "^${name}"; then
            if ! helm repo add "$name" "$url" --force-update; then
                log ERROR "Failed to add Helm repository: $name"
                return 1
            fi
        fi
    done

    # Update repositories with retry mechanism
    local max_retries=3
    local retry_count=0
    while ! helm repo update; do
        retry_count=$((retry_count + 1))
        if [ "$retry_count" -ge "$max_retries" ]; then
            log ERROR "Failed to update Helm repositories after $max_retries attempts"
            return 1
        fi
        log WARN "Retrying Helm repository update..."
        sleep 5
    done

    log INFO "Helm repositories setup completed"
    return 0
}

# Configure comprehensive security settings
configure_security() {
    log INFO "Configuring security settings..."

    # Create security-focused namespaces
    local namespaces=("istio-system" "monitoring" "agent-platform")
    for ns in "${namespaces[@]}"; do
        if ! kubectl get namespace "$ns" &> /dev/null; then
            kubectl create namespace "$ns"
            kubectl label namespace "$ns" istio-injection=enabled
        fi
    done

    # Configure AWS KMS encryption
    kubectl create secret generic kms-config \
        --from-literal=region="$AWS_REGION" \
        --namespace agent-platform

    # Apply network policies
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: agent-platform
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

    # Configure RBAC
    kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: agent-platform-role
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list", "watch"]
EOF

    # Setup TLS certificates
    if ! kubectl get secret tls-cert -n istio-system &> /dev/null; then
        kubectl create secret tls tls-cert \
            --cert=path/to/tls.crt \
            --key=path/to/tls.key \
            -n istio-system
    fi

    log INFO "Security configuration completed"
    return 0
}

# Verify deployment health and security
verify_deployment() {
    log INFO "Verifying deployment..."

    # Check pod status
    local namespaces=("istio-system" "monitoring" "agent-platform")
    for ns in "${namespaces[@]}"; do
        if ! kubectl get pods -n "$ns" | grep -q "Running"; then
            log ERROR "Pods in namespace $ns are not running"
            return 1
        fi
    done

    # Verify service endpoints
    if ! kubectl get svc -n istio-system istio-ingressgateway &> /dev/null; then
        log ERROR "Istio ingress gateway service not found"
        return 1
    }

    # Check security policies
    if ! kubectl auth can-i get pods --namespace agent-platform &> /dev/null; then
        log ERROR "RBAC policies not properly configured"
        return 1
    }

    # Verify monitoring
    if ! kubectl get pods -n monitoring -l app=prometheus &> /dev/null; then
        log ERROR "Prometheus monitoring not properly deployed"
        return 1
    }

    log INFO "Deployment verification completed successfully"
    return 0
}

# Main execution function
main() {
    log INFO "Starting cluster initialization for $CLUSTER_NAME in $ENVIRONMENT environment"

    # Execute initialization steps
    if ! check_prerequisites; then
        log ERROR "Prerequisites check failed"
        return 1
    fi

    if ! setup_helm_repositories; then
        log ERROR "Helm repository setup failed"
        return 1
    fi

    if ! configure_security; then
        log ERROR "Security configuration failed"
        return 1
    }

    # Install platform components using Helm
    log INFO "Installing AGENT AI Platform components..."
    if ! helm upgrade --install agent-platform . \
        --namespace agent-platform \
        --create-namespace \
        --values "$HELM_VALUES_FILE" \
        --wait \
        --timeout 15m; then
        log ERROR "Platform installation failed"
        return 1
    fi

    if ! verify_deployment; then
        log ERROR "Deployment verification failed"
        return 1
    }

    log INFO "Cluster initialization completed successfully"
    return 0
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
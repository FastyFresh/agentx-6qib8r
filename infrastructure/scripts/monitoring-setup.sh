#!/bin/bash

# AGENT AI Platform Monitoring Setup Script v1.0.0
# Sets up enterprise-grade monitoring stack with Prometheus, Grafana, and AlertManager
# Requires: kubectl v1.20+, helm v3+, jq

set -euo pipefail

# Configuration variables
NAMESPACE="monitoring"
PROMETHEUS_VERSION="2.45.0"  # Match version from prometheus.yml
GRAFANA_VERSION="9.5.0"      # Match version from system-metrics.json
ALERTMANAGER_VERSION="0.25.0"
RETENTION_DAYS="15"          # Match retention from prometheus.yml

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    local msg="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    case "$level" in
        "INFO")  echo -e "${GREEN}[INFO]${NC} ${timestamp} - $msg" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $msg" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} ${timestamp} - $msg" ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    local config_path=$1
    local namespace=$2
    
    log "INFO" "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "kubectl not found. Please install kubectl v1.20+"
        exit 1
    fi

    # Check helm
    if ! command -v helm &> /dev/null; then
        log "ERROR" "helm not found. Please install helm v3+"
        exit 1
    fi

    # Check jq
    if ! command -v jq &> /dev/null; then
        log "ERROR" "jq not found. Please install jq"
        exit 1
    }

    # Verify Kubernetes connection
    if ! kubectl cluster-info &> /dev/null; then
        log "ERROR" "Cannot connect to Kubernetes cluster"
        exit 1
    }

    # Check configuration files
    local required_files=("prometheus.yml" "alert-rules.yml" "system-metrics.json")
    for file in "${required_files[@]}"; do
        if [[ ! -f "${config_path}/${file}" ]]; then
            log "ERROR" "Required configuration file ${file} not found in ${config_path}"
            exit 1
        fi
    done

    # Verify namespace permissions
    if ! kubectl auth can-i create namespace --namespace "$namespace" &> /dev/null; then
        log "ERROR" "Insufficient permissions to create namespace $namespace"
        exit 1
    }

    log "INFO" "Prerequisites check completed successfully"
}

# Setup Prometheus
setup_prometheus() {
    local namespace=$1
    local config_path=$2

    log "INFO" "Setting up Prometheus..."

    # Add Prometheus helm repo
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    # Create Prometheus values file
    cat > prometheus-values.yaml <<EOF
prometheus:
  version: "${PROMETHEUS_VERSION}"
  retention: "${RETENTION_DAYS}d"
  configMapOverrideName: prometheus-server-conf
  persistentVolume:
    size: 50Gi
  securityContext:
    runAsNonRoot: true
    runAsUser: 65534
  config:
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
  additionalScrapeConfigs:
    - job_name: 'agent-services'
      kubernetes_sd_configs:
        - role: pod
      relabel_configs:
        - source_labels: [__meta_kubernetes_pod_label_app]
          action: keep
          regex: agent-.*
EOF

    # Deploy Prometheus
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$namespace" \
        --create-namespace \
        --values prometheus-values.yaml \
        --version "${PROMETHEUS_VERSION}" \
        --wait

    # Apply custom configurations
    kubectl create configmap prometheus-config \
        --from-file="${config_path}/prometheus.yml" \
        --from-file="${config_path}/alert-rules.yml" \
        --namespace "$namespace" \
        --dry-run=client -o yaml | kubectl apply -f -

    log "INFO" "Prometheus setup completed"
}

# Setup Grafana
setup_grafana() {
    local namespace=$1
    local config_path=$2

    log "INFO" "Setting up Grafana..."

    # Add Grafana helm repo
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Create Grafana values file
    cat > grafana-values.yaml <<EOF
grafana:
  version: "${GRAFANA_VERSION}"
  persistence:
    enabled: true
    size: 10Gi
  securityContext:
    runAsNonRoot: true
    runAsUser: 472
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'default'
          orgId: 1
          folder: ''
          type: file
          disableDeletion: false
          editable: true
          options:
            path: /var/lib/grafana/dashboards
  dashboards:
    default:
      system-metrics:
        file: dashboards/system-metrics.json
EOF

    # Deploy Grafana
    helm upgrade --install grafana grafana/grafana \
        --namespace "$namespace" \
        --values grafana-values.yaml \
        --version "${GRAFANA_VERSION}" \
        --wait

    # Import dashboards
    kubectl create configmap grafana-dashboards \
        --from-file="${config_path}/system-metrics.json" \
        --namespace "$namespace" \
        --dry-run=client -o yaml | kubectl apply -f -

    log "INFO" "Grafana setup completed"
}

# Setup AlertManager
setup_alertmanager() {
    local namespace=$1
    local config_path=$2

    log "INFO" "Setting up AlertManager..."

    # Create AlertManager config
    cat > alertmanager-config.yaml <<EOF
global:
  resolve_timeout: 5m
  slack_api_url: '${SLACK_WEBHOOK_URL:-}'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'

receivers:
- name: 'slack-notifications'
  slack_configs:
  - channel: '#monitoring-alerts'
    send_resolved: true
    title: '{{ template "slack.default.title" . }}'
    text: '{{ template "slack.default.text" . }}'
EOF

    # Deploy AlertManager
    helm upgrade --install alertmanager prometheus-community/alertmanager \
        --namespace "$namespace" \
        --set alertmanager.version="${ALERTMANAGER_VERSION}" \
        --set configMapOverrideName=alertmanager-config \
        --version "${ALERTMANAGER_VERSION}" \
        --wait

    # Apply AlertManager config
    kubectl create configmap alertmanager-config \
        --from-file=alertmanager.yml=alertmanager-config.yaml \
        --namespace "$namespace" \
        --dry-run=client -o yaml | kubectl apply -f -

    log "INFO" "AlertManager setup completed"
}

# Verify monitoring stack
verify_monitoring_stack() {
    local namespace=$1

    log "INFO" "Verifying monitoring stack..."

    # Check Prometheus
    if ! kubectl rollout status deployment/prometheus-server -n "$namespace" --timeout=300s; then
        log "ERROR" "Prometheus deployment failed"
        return 1
    fi

    # Check Grafana
    if ! kubectl rollout status deployment/grafana -n "$namespace" --timeout=300s; then
        log "ERROR" "Grafana deployment failed"
        return 1
    fi

    # Check AlertManager
    if ! kubectl rollout status deployment/alertmanager -n "$namespace" --timeout=300s; then
        log "ERROR" "AlertManager deployment failed"
        return 1
    }

    # Verify Prometheus targets
    local prometheus_pod=$(kubectl get pods -n "$namespace" -l app=prometheus -o jsonpath='{.items[0].metadata.name}')
    if ! kubectl exec -n "$namespace" "$prometheus_pod" -- wget -qO- http://localhost:9090/api/v1/targets | jq -e '.data.activeTargets[] | select(.health=="up")' > /dev/null; then
        log "WARN" "Some Prometheus targets are not up"
    fi

    log "INFO" "Monitoring stack verification completed"
    return 0
}

# Main setup function
main() {
    local config_path="${1:-./config}"
    
    # Check prerequisites
    check_prerequisites "$config_path" "$NAMESPACE"

    # Setup monitoring components
    setup_prometheus "$NAMESPACE" "$config_path"
    setup_grafana "$NAMESPACE" "$config_path"
    setup_alertmanager "$NAMESPACE" "$config_path"

    # Verify setup
    if verify_monitoring_stack "$NAMESPACE"; then
        log "INFO" "Monitoring stack setup completed successfully"
        
        # Get access information
        local grafana_password=$(kubectl get secret -n "$NAMESPACE" grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
        
        echo -e "\nAccess Information:"
        echo "Grafana URL: http://grafana.${NAMESPACE}.svc:3000"
        echo "Grafana Admin Password: $grafana_password"
        echo "Prometheus URL: http://prometheus-server.${NAMESPACE}.svc:9090"
        echo "AlertManager URL: http://alertmanager.${NAMESPACE}.svc:9093"
    else
        log "ERROR" "Monitoring stack setup failed"
        exit 1
    fi
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
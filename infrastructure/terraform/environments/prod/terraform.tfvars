# AWS Regional Configuration
aws_region = {
  primary   = "us-east-1"  # Primary region for production workloads
  secondary = "us-west-2"  # Secondary region for disaster recovery
}

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# EKS Cluster Configuration
kubernetes_version = "1.28"
node_groups = {
  prod_critical = {
    instance_types  = ["m5.2xlarge", "m5.4xlarge"]  # High-performance instance types
    desired_size    = 3
    min_size       = 3
    max_size       = 6
    disk_size      = 100
    labels = {
      "criticality" = "high"
      "environment" = "production"
    }
    taints = []  # No taints for critical workloads
  }
  prod_general = {
    instance_types  = ["m5.xlarge"]
    desired_size    = 5
    min_size       = 3
    max_size       = 10
    disk_size      = 100
    labels = {
      "criticality" = "medium"
      "environment" = "production"
    }
    taints = []
  }
}

# Cluster Autoscaler Configuration
cluster_autoscaler_config = {
  scale_down_delay_after_add     = "10m"
  scale_down_unneeded_time      = "10m"
  max_node_provision_time       = "15m"
  scan_interval                 = "10s"
  scale_down_utilization_threshold = 0.5
}

# RDS Database Configuration
db_config = {
  instance_class     = "db.r6g.2xlarge"  # Memory-optimized instance for high performance
  allocated_storage  = 500  # Initial storage in GB
  multi_az          = true  # Enable multi-AZ deployment
  backup_retention  = 30    # 30 days backup retention
  maintenance_window = "Sun:04:00-Sun:06:00"
  performance_insights_config = {
    enabled = true
    retention_period = 7  # Days to retain performance data
  }
}

# Security Configuration
security_config = {
  encryption_enabled    = true
  kms_key_id           = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/PRODUCTION_KEY_ID"
  monitoring_interval  = 60  # Enhanced monitoring interval in seconds
  ssl_policy          = "ELBSecurityPolicy-TLS-1-2-2017-01"
  waf_enabled         = true
  shield_advanced     = true
  allowed_ips         = ["10.0.0.0/8"]  # Internal network CIDR
}

# Monitoring and Logging
monitoring_config = {
  metrics_enabled     = true
  detailed_monitoring = true
  retention_days     = 90
  log_types          = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  alarm_email        = "ops-team@company.com"
  dashboard_enabled  = true
}

# Resource Tags
tags = {
  Environment     = "production"
  Project         = "AGENT-AI-Platform"
  ManagedBy      = "Terraform"
  BusinessUnit   = "AI-Operations"
  CostCenter     = "PROD-001"
  DataClass      = "confidential"
  Compliance     = "SOC2,GDPR"
  BackupPolicy   = "daily"
  DR             = "enabled"
}

# Backup Configuration
backup_config = {
  retention_period = 30
  backup_window   = "03:00-05:00"
  enabled         = true
  transition_days = {
    glacier       = 90
    deep_archive = 365
  }
}

# ElastiCache Configuration
cache_config = {
  node_type             = "cache.r6g.xlarge"
  num_cache_nodes      = 3
  engine               = "redis"
  engine_version      = "7.0"
  parameter_group_family = "redis7"
  port                 = 6379
  maintenance_window   = "sun:05:00-sun:07:00"
}
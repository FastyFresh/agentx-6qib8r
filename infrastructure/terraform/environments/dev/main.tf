# Terraform configuration for AGENT AI Platform Development Environment
# Version: 1.0.0

terraform {
  required_version = ">=1.5.0"

  # Backend configuration for state management
  backend "s3" {
    bucket         = "agent-ai-platform-tfstate-dev"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "agent-ai-platform-tfstate-lock-dev"
    versioning     = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws" # version ~> 5.0
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/aws" # version ~> 2.23
      version = "~> 2.23"
    }
    random = {
      source  = "hashicorp/random" # version ~> 3.5
      version = "~> 3.5"
    }
  }
}

# Provider configurations
provider "aws" {
  region = "us-west-2"
  profile = "dev"
  default_tags = local.common_tags
}

# Local variables
locals {
  environment = "dev"
  common_tags = {
    Environment = "dev"
    Project     = "AGENT-AI-Platform"
    ManagedBy   = "Terraform"
    CostCenter  = "Development"
    AutoShutdown = "true"
    Debug       = "enabled"
  }
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr             = "10.0.0.0/16"
  environment          = local.environment
  enable_dns_hostnames = true
  enable_dns_support   = true
  enable_nat_gateway   = true
  enable_flow_logs     = true
  flow_logs_retention_days = 7

  tags = local.common_tags
}

# EKS Module
module "eks" {
  source = "../../modules/eks"

  cluster_name    = "agent-ai-platform-dev"
  kubernetes_version = "1.27"
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  enable_monitoring = true

  node_groups = {
    general = {
      desired_size = 2
      min_size     = 1
      max_size     = 3
      instance_types = ["t3.medium"]
      capacity_type = "SPOT"
      disk_size    = 50
      labels = {
        Environment = "dev"
        NodeGroup  = "general"
      }
      taints = []
    }
  }

  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  instance_class = "db.t3.medium"
  allocated_storage = 20
  environment    = local.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  
  backup_retention_period = 1
  skip_final_snapshot    = true
  performance_insights_enabled = true

  tags = local.common_tags
}

# ElastiCache Module
module "elasticache" {
  source = "../../modules/elasticache"

  node_type       = "cache.t3.micro"
  num_cache_nodes = 1
  environment     = local.environment
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  
  automatic_failover_enabled = false
  snapshot_retention_limit   = 0

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS cluster"
  value       = module.eks.cluster_endpoint
}

output "monitoring_endpoints" {
  description = "Monitoring endpoints for development debugging"
  value = {
    cloudwatch_log_group = module.eks.cloudwatch_log_group_name
    prometheus_endpoint  = module.eks.prometheus_endpoint
  }
}
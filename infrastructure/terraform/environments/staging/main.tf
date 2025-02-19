# Terraform configuration for AGENT AI Platform Staging Environment
# Version: 1.0.0

terraform {
  required_version = ">= 1.5.0"

  # Backend configuration for state management
  backend "s3" {
    bucket         = "agent-ai-platform-staging-tfstate"
    key            = "staging/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = "agent-ai-platform-staging-tflock"
    kms_key_id     = var.kms_key_id
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws" # version ~> 5.0
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes" # version ~> 2.23
      version = "~> 2.23"
    }
  }
}

# Local variables for staging environment
locals {
  environment = "staging"
  common_tags = {
    Project            = "AGENT-AI-Platform"
    Environment        = local.environment
    ManagedBy         = "Terraform"
    CostCenter        = "DevOps"
    DataClassification = "Confidential"
  }
}

# Provider configurations
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = local.common_tags
  }

  assume_role {
    role_arn     = var.terraform_role_arn
    session_name = "TerraformStaging"
  }
}

provider "kubernetes" {
  host                   = module.aws_main.eks_cluster_endpoint
  cluster_ca_certificate = base64decode(module.aws_main.eks_cluster_ca_cert)
  token                  = module.aws_main.eks_cluster_auth_token

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", "agent-ai-staging"]
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# Main AWS infrastructure module
module "aws_main" {
  source = "../../aws"

  environment = local.environment
  vpc_cidr    = "10.1.0.0/16"  # Staging VPC CIDR block

  # EKS Configuration
  cluster_name = "agent-ai-staging"
  node_groups = {
    general = {
      desired_size    = 2
      min_size        = 2
      max_size        = 4
      instance_types  = ["t3.large"]
      capacity_type   = "SPOT"  # Cost optimization for staging
    }
  }

  # Database Configuration
  db_instance_class         = "db.t3.large"
  db_allocated_storage      = 50
  db_backup_retention_period = 7
  
  # Cache Configuration
  cache_node_type          = "cache.t3.medium"
  cache_num_nodes          = 2

  # Security Configuration
  enable_encryption        = true
  
  # Monitoring Configuration
  monitoring_interval      = 60
  
  # Maintenance Configuration
  auto_minor_version_upgrade = true
  deletion_protection       = false
  enable_performance_insights = true
}

# VPC Module for staging environment
module "vpc_module" {
  source = "../../modules/vpc"

  vpc_cidr            = "10.1.0.0/16"
  environment         = local.environment
  availability_zones  = data.aws_availability_zones.available.names
  enable_nat_gateway  = true
  enable_dns_support  = true
  enable_dns_hostnames = true
  
  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "The ID of the staging VPC"
  value       = module.vpc_module.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for staging EKS cluster"
  value       = module.aws_main.eks_cluster_endpoint
  sensitive   = true
}
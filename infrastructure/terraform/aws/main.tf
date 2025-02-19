# Terraform configuration for AGENT AI Platform AWS Infrastructure
# Version: 1.0.0

terraform {
  required_version = ">= 1.5.0"

  # Backend configuration for state management
  backend "s3" {
    bucket         = "agent-ai-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
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

# Provider configurations
provider "aws" {
  region = var.aws_region
  assume_role {
    role_arn     = var.terraform_role_arn
    session_name = "TerraformDeployment"
  }
  default_tags = local.common_tags
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = module.eks.cluster_ca_certificate
  token                  = module.eks.cluster_token
}

# Local variables
locals {
  common_tags = {
    Project            = "AGENT-AI-Platform"
    Environment        = var.environment
    ManagedBy         = "Terraform"
    SecurityLevel     = "High"
    ComplianceLevel   = "Enterprise"
    BackupEnabled     = "true"
    MonitoringEnabled = "true"
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# VPC Module
module "vpc" {
  source = "../modules/vpc"

  vpc_cidr            = var.vpc_config.cidr_block
  environment         = var.environment
  availability_zones  = data.aws_availability_zones.available.names
  enable_nat_gateway  = var.vpc_config.enable_nat_gateway
  enable_dns_support  = true
  enable_dns_hostnames = true
  tags                = local.common_tags
}

# EKS Module
module "eks" {
  source = "../modules/eks"

  cluster_name    = var.eks_config.cluster_name
  cluster_version = var.eks_config.cluster_version
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  node_groups     = var.node_groups
  environment     = var.environment

  enabled_logs     = var.eks_config.enabled_logs
  retention_days   = var.eks_config.retention_days
  public_access    = var.eks_config.public_access
  private_access   = var.eks_config.private_access
  security_groups  = var.eks_config.security_groups
  service_ipv4_cidr = var.eks_config.service_ipv4_cidr

  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "../modules/rds"

  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  instance_class  = var.db_config.instance_class
  engine          = var.db_config.engine
  engine_version  = var.db_config.engine_version
  storage_type    = var.db_config.storage_type
  allocated_storage = var.db_config.allocated_storage
  multi_az        = var.db_config.multi_az
  environment     = var.environment

  backup_retention_period = var.db_config.backup_retention
  backup_window          = var.db_config.backup_window
  username               = var.db_config.username
  password               = var.db_config.password

  tags = local.common_tags
}

# ElastiCache Module
module "elasticache" {
  source = "../modules/elasticache"

  vpc_id           = module.vpc.vpc_id
  subnet_ids       = module.vpc.private_subnet_ids
  node_type        = var.cache_config.node_type
  num_cache_nodes  = var.cache_config.num_cache_nodes
  engine           = var.cache_config.engine
  engine_version   = var.cache_config.engine_version
  port             = var.cache_config.port
  environment      = var.environment

  parameter_group_family = var.cache_config.parameter_group_family
  maintenance_window    = var.cache_config.maintenance_window

  tags = local.common_tags
}

# KMS Module for encryption
module "kms" {
  source = "../modules/kms"

  environment       = var.environment
  enable_encryption = var.security_config.encryption_at_rest
  key_rotation      = var.security_config.key_rotation
  tags             = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS cluster"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "rds_endpoint" {
  description = "Endpoint for RDS instance"
  value       = module.rds.endpoint
  sensitive   = true
}

output "elasticache_endpoint" {
  description = "Endpoint for ElastiCache cluster"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}
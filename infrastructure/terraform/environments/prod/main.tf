# Terraform configuration for AGENT AI Platform Production Environment
# Version: 1.0.0

terraform {
  required_version = ">= 1.5.0"

  # Backend configuration for state management
  backend "s3" {
    bucket         = "agent-ai-platform-terraform-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock-prod"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/aws"
      version = "~> 2.23"
    }
  }
}

# Local variables
locals {
  environment = "prod"
  common_tags = {
    Environment        = "Production"
    Project           = "AGENT-AI-Platform"
    ManagedBy         = "Terraform"
    SecurityLevel     = "High"
    ComplianceRequired = "Yes"
  }
}

# Provider configurations
provider "aws" {
  region = "us-west-2"
  default_tags {
    tags = local.common_tags
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority.data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.eks.cluster_id
    ]
  }
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr             = "10.0.0.0/16"
  environment          = local.environment
  availability_zones   = ["us-west-2a", "us-west-2b", "us-west-2c"]
  enable_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true
  enable_vpn_gateway   = true
  enable_flow_logs     = true
  flow_logs_retention_days = 90

  tags = local.common_tags
}

# EKS Module
module "eks" {
  source = "../../modules/eks"

  cluster_name    = "agent-ai-platform-prod"
  kubernetes_version = "1.27"
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids

  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  enable_secrets_encryption      = true

  node_groups = {
    app = {
      instance_types  = ["t3.xlarge"]
      desired_size    = 3
      min_size       = 3
      max_size       = 10
      disk_size      = 100
      labels = {
        Environment = "production"
        Type       = "application"
      }
      taints = []
      enable_detailed_monitoring = true
    },
    monitoring = {
      instance_types  = ["t3.large"]
      desired_size    = 2
      min_size       = 2
      max_size       = 4
      disk_size      = 50
      labels = {
        Environment = "production"
        Type       = "monitoring"
      }
      taints = []
      enable_detailed_monitoring = true
    }
  }

  cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

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
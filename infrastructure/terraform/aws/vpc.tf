# AWS Provider configuration
# Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source for available AWS Availability Zones
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC Module implementation
module "vpc" {
  source = "../modules/vpc"

  # VPC CIDR block from variables
  vpc_cidr = var.vpc_config.cidr_block

  # Environment name for resource tagging
  environment = var.environment

  # List of availability zones for multi-AZ deployment
  availability_zones = data.aws_availability_zones.available.names

  # Enable DNS support and hostnames
  enable_dns_support   = true
  enable_dns_hostnames = true

  # Enable NAT Gateway for private subnet internet access
  enable_nat_gateway = var.vpc_config.enable_nat_gateway

  # Resource tagging
  tags = {
    Project     = "AGENT AI Platform"
    Terraform   = "true"
    Environment = var.environment
    ManagedBy   = "terraform"
    CreatedBy   = "vpc-module"
    Purpose     = "network-infrastructure"
  }
}

# Output: VPC ID
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

# Output: Private Subnet IDs
output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

# Output: Public Subnet IDs
output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}
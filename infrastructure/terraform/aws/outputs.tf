# Network Infrastructure Outputs
output "vpc_id" {
  description = "The ID of the VPC where the AGENT AI Platform is deployed"
  value       = module.vpc.vpc_id
  sensitive   = false
}

output "private_subnet_ids" {
  description = "List of private subnet IDs used for secure service deployment"
  value       = module.vpc.private_subnet_ids
  sensitive   = false
}

output "public_subnet_ids" {
  description = "List of public subnet IDs used for load balancers and public access"
  value       = module.vpc.public_subnet_ids
  sensitive   = false
}

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster API server"
  value       = module.eks.cluster_endpoint
  sensitive   = false
}

output "eks_cluster_certificate_authority" {
  description = "The base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority
  sensitive   = true
}

output "eks_security_group_id" {
  description = "The security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
  sensitive   = false
}

# Database Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the RDS PostgreSQL instance"
  value       = module.rds.db_endpoint
  sensitive   = false
}

output "rds_port" {
  description = "The port number on which the database accepts connections"
  value       = module.rds.db_port
  sensitive   = false
}

output "rds_database_name" {
  description = "The name of the default database created during RDS instance creation"
  value       = module.rds.db_name
  sensitive   = false
}

# High Availability Configuration
output "availability_zones" {
  description = "List of availability zones where the infrastructure is deployed"
  value       = module.vpc.availability_zones
  sensitive   = false
}

# Integration Configuration
output "eks_oidc_provider_url" {
  description = "The OpenID Connect provider URL for EKS IAM role integration"
  value       = module.eks.oidc_provider_url
  sensitive   = false
}

output "eks_cluster_version" {
  description = "The Kubernetes version running on the EKS cluster"
  value       = module.eks.cluster_version
  sensitive   = false
}

# Monitoring and Logging
output "eks_cluster_log_group_name" {
  description = "The CloudWatch log group name for EKS cluster logs"
  value       = module.eks.cluster_log_group_name
  sensitive   = false
}

output "rds_enhanced_monitoring_role_arn" {
  description = "The ARN of the IAM role used for RDS enhanced monitoring"
  value       = module.rds.monitoring_role_arn
  sensitive   = false
}

# Security Configuration
output "vpc_cidr_block" {
  description = "The CIDR block of the VPC for network policy configuration"
  value       = module.vpc.vpc_cidr_block
  sensitive   = false
}

output "eks_node_security_group_id" {
  description = "The security group ID for EKS worker nodes"
  value       = module.eks.node_security_group_id
  sensitive   = false
}

# Resource Tags
output "common_tags" {
  description = "Common tags applied to all resources for tracking and management"
  value       = {
    Environment = var.environment
    Project     = "AGENT AI Platform"
    ManagedBy   = "terraform"
    Terraform   = "true"
  }
  sensitive   = false
}
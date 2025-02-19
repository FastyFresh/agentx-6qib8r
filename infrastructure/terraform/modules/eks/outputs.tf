# Output definitions for the AWS EKS module
# Version: ~> 1.5

output "cluster_id" {
  description = "The ID/ARN of the EKS cluster for cross-module and external references"
  value       = aws_eks_cluster.main.id
}

output "cluster_endpoint" {
  description = "The endpoint URL for the EKS cluster's Kubernetes API server"
  value       = aws_eks_cluster.main.endpoint
  sensitive   = false
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate authority data for the EKS cluster's certificate authority"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_security_group_id" {
  description = "The ID of the security group created for the EKS cluster control plane communication"
  value       = aws_security_group.eks_cluster.id
}

output "node_groups" {
  description = "Map of all EKS node groups created and their properties including instance types, scaling configuration, and resource IDs"
  value = {
    for k, v in aws_eks_node_group.main : k => {
      id = v.id
      resources = v.resources
      status = v.status
      scaling_config = v.scaling_config
    }
  }
}

output "cluster_role_arn" {
  description = "The ARN of the IAM role used by the EKS cluster"
  value       = aws_iam_role.eks_cluster.arn
}

output "node_role_arn" {
  description = "The ARN of the IAM role used by the EKS node groups"
  value       = aws_iam_role.eks_node.arn
}

output "cluster_version" {
  description = "The Kubernetes version running on the EKS cluster"
  value       = aws_eks_cluster.main.version
}

output "cluster_platform_version" {
  description = "Platform version of the EKS cluster"
  value       = aws_eks_cluster.main.platform_version
}

output "cluster_status" {
  description = "Status of the EKS cluster"
  value       = aws_eks_cluster.main.status
}

output "cluster_encryption_config" {
  description = "Encryption configuration for the cluster"
  value = {
    key_arn     = aws_kms_key.eks.arn
    resources   = ["secrets"]
  }
  sensitive = true
}

output "cluster_log_types_enabled" {
  description = "List of enabled control plane logging types"
  value       = aws_eks_cluster.main.enabled_cluster_log_types
}

output "cluster_vpc_config" {
  description = "VPC configuration details for the cluster"
  value = {
    vpc_id             = var.vpc_id
    subnet_ids         = var.subnet_ids
    security_group_ids = [aws_security_group.eks_cluster.id]
  }
}
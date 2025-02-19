# AWS Provider and data sources for dynamic ARN construction
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# EKS Cluster IAM Role
resource "aws_iam_role" "eks_cluster_role" {
  name        = "${var.cluster_name}-cluster-role"
  description = "IAM role for EKS cluster with enhanced security controls"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount": data.aws_caller_identity.current.account_id
        }
      }
    }]
  })

  permissions_boundary = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/EKSPermissionBoundary"
  
  tags = {
    Name          = "${var.cluster_name}-cluster-role"
    Environment   = var.environment
    SecurityLevel = "Critical"
    ManagedBy     = "Terraform"
  }
}

# Attach required AWS managed policies to cluster role
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

resource "aws_iam_role_policy_attachment" "eks_service_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

# EKS Node IAM Role
resource "aws_iam_role" "eks_node_role" {
  name        = "${var.cluster_name}-node-role"
  description = "IAM role for EKS worker nodes with strict permissions"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount": data.aws_caller_identity.current.account_id
        }
      }
    }]
  })

  permissions_boundary = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/EKSNodePermissionBoundary"
  
  tags = {
    Name          = "${var.cluster_name}-node-role"
    Environment   = var.environment
    SecurityLevel = "High"
    ManagedBy     = "Terraform"
  }
}

# Attach required AWS managed policies to node role
resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_iam_role_policy_attachment" "ecr_read_only" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_role.name
}

# Custom KMS policy for encryption
resource "aws_iam_role_policy" "eks_kms_policy" {
  name = "${var.cluster_name}-kms-policy"
  role = aws_iam_role.eks_node_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ]
      Resource = [
        "arn:aws:kms:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:key/*"
      ]
      Condition = {
        StringEquals = {
          "kms:ViaService": ["eks.${data.aws_region.current.name}.amazonaws.com"]
        }
      }
    }]
  })
}

# CloudWatch logging policy
resource "aws_iam_role_policy" "eks_cloudwatch_policy" {
  name = "${var.cluster_name}-cloudwatch-policy"
  role = aws_iam_role.eks_node_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:CreateLogGroup"
      ]
      Resource = [
        "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/eks/${var.cluster_name}*"
      ]
    }]
  })
}

# SSM policy for node management
resource "aws_iam_role_policy" "eks_ssm_policy" {
  name = "${var.cluster_name}-ssm-policy"
  role = aws_iam_role.eks_node_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ]
      Resource = [
        "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/eks/${var.cluster_name}/*"
      ]
    }]
  })
}

# Export role ARNs for use in other configurations
output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster_role.arn
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node group IAM role"
  value       = aws_iam_role.eks_node_role.arn
}
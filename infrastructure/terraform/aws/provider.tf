# Configure Terraform version and required providers
terraform {
  # Terraform version constraint as per Technical Specifications/4. TECHNOLOGY STACK
  required_version = ">= 1.5.0"

  required_providers {
    # AWS provider version ~> 5.0 for latest features and security updates
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # Kubernetes provider for EKS management
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

# AWS Provider configuration with multi-region support and default tags
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project             = "AGENT-AI-Platform"
      ManagedBy          = "Terraform"
      Environment        = var.environment
      SecurityLevel      = "High"
      ComplianceRequired = "true"
      LastUpdated       = timestamp()
    }
  }
}

# Data source to fetch EKS cluster information
data "aws_eks_cluster" "cluster" {
  name = var.cluster_name
}

# Data source to fetch EKS cluster authentication token
data "aws_eks_cluster_auth" "cluster" {
  name = var.cluster_name
}

# Kubernetes provider configuration for EKS cluster management
provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token

  # AWS CLI authentication for EKS
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      var.cluster_name
    ]
  }
}
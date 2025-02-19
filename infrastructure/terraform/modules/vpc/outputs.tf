# VPC Outputs
output "vpc_id" {
  description = "The ID of the created VPC for reference by other modules and resources"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC for network planning and security group configuration"
  value       = aws_vpc.main.cidr_block
}

# Subnet Outputs
output "public_subnet_ids" {
  description = "List of public subnet IDs across availability zones for load balancer and public-facing resources"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs across availability zones for secure workload deployment"
  value       = aws_subnet.private[*].id
}

# Gateway Outputs
output "internet_gateway_id" {
  description = "The ID of the Internet Gateway for public subnet internet access"
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs for private subnet internet access across availability zones"
  value       = aws_nat_gateway.main[*].id
}

# Additional Network Information
output "public_subnet_cidr_blocks" {
  description = "List of public subnet CIDR blocks for network planning and security configuration"
  value       = aws_subnet.public[*].cidr_block
}

output "private_subnet_cidr_blocks" {
  description = "List of private subnet CIDR blocks for network planning and security configuration"
  value       = aws_subnet.private[*].cidr_block
}

output "availability_zones_used" {
  description = "List of availability zones where the subnets are deployed"
  value       = aws_subnet.public[*].availability_zone
}

output "vpc_default_security_group_id" {
  description = "The ID of the VPC's default security group for reference and management"
  value       = aws_vpc.main.default_security_group_id
}

output "vpc_main_route_table_id" {
  description = "The ID of the VPC's main route table for network routing management"
  value       = aws_vpc.main.main_route_table_id
}
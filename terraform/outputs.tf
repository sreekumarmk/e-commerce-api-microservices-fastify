output "cluster_endpoint" {
  description = "EKS Cluster Endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_name" {
  description = "EKS Cluster Name"
  value       = aws_eks_cluster.main.name
}

output "rds_endpoint" {
  description = "RDS Endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_username" {
  description = "RDS Username"
  value       = aws_db_instance.main.username
}

output "region" {
  description = "AWS Region"
  value       = var.region
}

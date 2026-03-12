#!/bin/bash
# Fetch dynamic values using AWS CLI if available, otherwise use defaults
REGION=${AWS_REGION:-"us-east-1"}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "<YOUR_ACCOUNT_ID>")
RDS_HOST=$(aws rds describe-db-instances --query "DBInstances[?Tags[?Key=='Name' && Value=='ecommerce-eks-rds']].Endpoint.Address" --output text 2>/dev/null || echo "<RDS_ENDPOINT>")

REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "Using Registry: $REGISTRY"
echo "Using RDS Host: $RDS_HOST"

# Fix redis-cluster typo if present
if [ -f k8s/product-service.yaml ]; then
  sed -i 's/redis-cluster/redis/g' k8s/product-service.yaml
fi

# Replace ECR URLs in all manifests
sed -i "s|<ECR_REPO_URL_AUTH>|${REGISTRY}/auth-service|g" k8s/auth-service.yaml 2>/dev/null
sed -i "s|<ECR_REPO_URL_PRODUCT>|${REGISTRY}/product-service|g" k8s/product-service.yaml 2>/dev/null
sed -i "s|<ECR_REPO_URL_ORDER>|${REGISTRY}/order-service|g" k8s/order-service.yaml 2>/dev/null
sed -i "s|<ECR_REPO_URL_CART>|${REGISTRY}/cart-service|g" k8s/cart-service.yaml 2>/dev/null
sed -i "s|<ECR_REPO_URL_API_GATEWAY>|${REGISTRY}/api-gateway|g" k8s/api-gateway.yaml 2>/dev/null
sed -i "s|<ECR_REPO_URL_WORKER>|${REGISTRY}/worker|g" k8s/worker.yaml 2>/dev/null

# Replace RDS Endpoint in all manifests
sed -i "s|<RDS_ENDPOINT>|${RDS_HOST}|g" k8s/*.yaml 2>/dev/null

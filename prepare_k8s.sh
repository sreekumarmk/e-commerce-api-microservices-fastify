#!/bin/bash
RDS_HOST="terraform-20260312055737195100000006.c07qk0isy4l4.us-east-1.rds.amazonaws.com"
ACCOUNT_ID="505833152145"
REGION="us-east-1"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Fix redis-cluster typo
sed -i 's/redis-cluster/redis/g' k8s/product-service.yaml

# Replace ECR URLs
sed -i "s|<ECR_REPO_URL_AUTH>|${REGISTRY}/auth-service|g" k8s/auth-service.yaml
sed -i "s|<ECR_REPO_URL_PRODUCT>|${REGISTRY}/product-service|g" k8s/product-service.yaml
sed -i "s|<ECR_REPO_URL_ORDER>|${REGISTRY}/order-service|g" k8s/order-service.yaml
sed -i "s|<ECR_REPO_URL_CART>|${REGISTRY}/cart-service|g" k8s/cart-service.yaml
sed -i "s|<ECR_REPO_URL_API_GATEWAY>|${REGISTRY}/api-gateway|g" k8s/api-gateway.yaml
sed -i "s|<ECR_REPO_URL_WORKER>|${REGISTRY}/worker|g" k8s/worker.yaml

# Replace RDS Endpoint
sed -i "s|<RDS_ENDPOINT>|${RDS_HOST}|g" k8s/*.yaml

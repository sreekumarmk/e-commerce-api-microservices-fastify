# Fastify Microservices with Postgres, Redis, Prisma

Services included:
- api-gateway
- auth-service (Prisma + Postgres)
- product-service (Prisma + Postgres, Redis Streams, Webhooks)
- order-service (Prisma + Postgres, consumes Redis Streams)
- cart-service (Redis)
- worker (background retry for webhooks)

## Local Development (Docker)

1. Start docker services:
   ```bash
   docker compose up --build
   ```

2. For each service with Prisma (auth-service, product-service, order-service):
   ```bash
   cd <service>
   npx prisma generate
   npx prisma db push
   node prisma/seed.js  # if exists
   ```

## AWS EKS Deployment (Cost Optimized)

This project is set up to deploy to a cost-optimized AWS EKS cluster with a full CI/CD pipeline.

### Prerequisites

1.  **AWS Account**: Ensure you have an IAM user with appropriate permissions.
2.  **GitHub Secrets**: Add these to your repository settings:
    - `AWS_ACCESS_KEY_ID`
    - `AWS_SECRET_ACCESS_KEY`
    - `AWS_REGION` (e.g., `us-east-1`)

### Step 1: Provision Infrastructure

Push the contents of the `terraform/` directory to the `main` branch. The `terraform.yml` workflow will:
- Create a VPC with a single NAT Gateway (Saves ~$32/month).
- Provision an RDS PostgreSQL instance (`db.t3.micro`).
- Set up an EKS Cluster with **Spot Instances** (`t3.medium`).
- Create ECR repositories for each service with image lifecycle policies.

### Step 2: Deploy Microservices

Once the infrastructure is ready, any change to a service's directory (e.g., `auth-service/`) will trigger its specific CI/CD pipeline:
1.  **Build**: Docker image is built and tagged with the GitHub SHA.
2.  **Push**: Image is pushed to its corresponding AWS ECR repository.
3.  **Deploy**: A Kubernetes **RollingUpdate** is triggered on EKS.

### Zero-Downtime Deployment
The deployment uses Kubernetes `RollingUpdate` strategy with health probes. This ensures that new pods are ready before the old ones are removed, maintaining 100% availability during updates.

### Step 3: Connect to Cluster

After deployment, update your local `kubeconfig`:
```bash
aws eks update-kubeconfig --name ecommerce-eks --region <your-region>
```

Verify your services are running:
```bash
kubectl get pods
kubectl get svc
```

## Cost Estimation
- **Monthly**: Approx. $130 - $150 (depending on traffic and NAT usage).
- **Testing (8 hours)**: Approx. **$1.60 - $2.00**.

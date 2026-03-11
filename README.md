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

## API Endpoints

All external API requests are routed through the `api-gateway` service. The gateway directs traffic to the underlying microservices using URL prefixes.

### Accessing Endpoints in AWS EKS

When deployed to EKS, the `api-gateway` is exposed as a Kubernetes `LoadBalancer` service. You can find the external DNS name (Base URL) to use for your API requests by running:

```bash
# Get the External IP/DNS of the API Gateway LoadBalancer
kubectl get svc api-gateway
# OR specifically extract the hostname:
export API_BASE_URL="http://$(kubectl get svc api-gateway -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
```

You can then use this `$API_BASE_URL` (e.g., `http://ad123...elb.us-east-1.amazonaws.com`) to make requests.

### Authentication

Most endpoints require a JWT token passed in the `Authorization` header:
`Authorization: Bearer <your_access_token>`

### 1. Auth Service (`/auth`)

*   `POST /auth/signup`: Create a new user (`email`, `password`, `firstName`, `lastName`).
*   `POST /auth/login`: Login to receive `access` and `refresh` tokens.
*   `GET /auth/users`: List all users.
*   `GET /auth/user?id=...`: Get user by ID.
*   `GET /auth/profile?email=...`: Get user by email.
*   `POST /auth/token`: Refresh an access token using a `refresh` token.

### 2. Product Service (`/products`) - *Publicly Accessible*

*   `GET /products/list`: List all products.
*   `GET /products/:id`: Get product details.
*   `POST /products/create`: Create a product.
*   `PATCH /products/update/:id`: Update a product.
*   `POST /products/reserve`: Reserve stock.

### 3. Order Service (`/orders`) - *Requires Authentication*

*   `POST /orders/create`: Create an order (`user`, `products` array).
*   `GET /orders/list`: List all orders.
*   `GET /orders/me`: List orders for the authenticated user.
*   `GET /orders/:id`: Get order details.

### 4. Cart Service (`/cart`) - *Requires Authentication*

*   `POST /cart/add`: Add an item to the cart (`userId`, `productId`, `qty`).
*   `GET /cart/:userId`: Get cart items and subtotal.
*   `DELETE /cart/:userId/:productId`: Remove a specific item from the cart.
*   `POST /cart/delete`: Alternative to remove an item (`userId`, `productId`).

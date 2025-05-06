# E-Commerce Frontend Docker Setup

This guide explains how to run the frontend as a separate Docker container, independent from the main docker-compose setup.

## Prerequisites

- Docker installed on your system
- The backend services are already running (`docker-compose up -d` in the project root)

## Running the Frontend Container

### Option 1: Using the provided scripts

#### On Linux/Mac:

```bash
# Make the script executable
chmod +x build-and-run.sh

# Run the script
./build-and-run.sh
```

#### On Windows:

```powershell
# Run the PowerShell script
./build-and-run.ps1
```

### Option 2: Manual steps

1. Build the Docker image:

```bash
docker build -t ecommerce-frontend \
  --build-arg VITE_BACKEND_URL=http://localhost:3001 \
  --build-arg VITE_PRODUCT_SERVICE_URL=http://localhost:3002 \
  --build-arg VITE_CART_SERVICE_URL=http://localhost:3003 \
  --build-arg VITE_ORDER_SERVICE_URL=http://localhost:3004 \
  --build-arg VITE_PAYMENT_SERVICE_URL=http://localhost:3005 \
  .
```

2. Run the container:

```bash
docker run -d \
  --name ecommerce-frontend \
  -p 5173:5173 \
  --network e-commerce-distributed_ecommerce-network \
  ecommerce-frontend
```

The frontend will be accessible at: http://localhost:5173

## Customizing Service URLs

To connect to backend services hosted elsewhere, adjust the URL arguments when building:

```bash
docker build -t ecommerce-frontend \
  --build-arg VITE_BACKEND_URL=http://your-backend-host:3001 \
  --build-arg VITE_PRODUCT_SERVICE_URL=http://your-product-service:3002 \
  ...
  .
```

## Troubleshooting

1. **Network connection issues**: Ensure you're connecting to the same network as your backend services. If the network name is different, update the `--network` parameter in the run command.

2. **Container already exists**: If you get an error that the container already exists, remove it first:
   ```bash
   docker rm -f ecommerce-frontend
   ```

3. **Port conflicts**: If port 5173 is already in use, change the port mapping (e.g., `-p 8080:5173`) 
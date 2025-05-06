#!/bin/bash

# Build the frontend Docker image
echo "Building frontend image..."
docker build -t ecommerce-frontend \
  --build-arg VITE_BACKEND_URL=http://localhost:3001 \
  --build-arg VITE_PRODUCT_SERVICE_URL=http://localhost:3002 \
  --build-arg VITE_CART_SERVICE_URL=http://localhost:3003 \
  --build-arg VITE_ORDER_SERVICE_URL=http://localhost:3004 \
  --build-arg VITE_PAYMENT_SERVICE_URL=http://localhost:3005 \
  .

# Run the frontend container
echo "Starting frontend container..."
docker run -d \
  --name ecommerce-frontend \
  -p 5173:5173 \
  --network e-commerce-distributed_ecommerce-network \
  ecommerce-frontend

echo "Frontend is now running at http://localhost:5173" 
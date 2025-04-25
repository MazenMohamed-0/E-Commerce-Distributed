# ProductService Directory Structure and Services

## Service Components

### Product Management Service (`services/productService.js`)
- Product CRUD operations
- Seller association
- Stock management
- Product validation
- Seller information integration

## Directory Structure
```
ProductService/
├── middleware/         # Authentication middleware
├── models/            # Product model definition
├── routes/            # Product API routes
└── services/          # Product service implementation
```

## Core Components

### Models (`models/Product.js`)
- Product schema definition
- Price and stock tracking
- Seller association
- Category management
- Image handling

### Routes (`routes/productRoutes.js`)
- Product CRUD endpoints
- Public product listing
- Seller/Admin protected routes
- Search and filtering

### Middleware (`middleware/authMiddleware.js`)
- JWT validation
- Seller/Admin authorization
- Request authentication

## Service Integration
ProductService integrates with:
- AuthService for seller verification
- CartService for stock validation
- Frontend for product management UI

## Product Features
- Complete product information management
- Stock tracking
- Seller association
- Category organization
- Image URL management
- Price management

See the Setup Instructions and other details in the sections below for running the service.

## Overview
ProductService manages product data for the e-commerce microservices platform. It allows sellers and admins to create, update, and delete products, and provides public endpoints for product browsing.

## Features
- CRUD operations for products
- Public product listing and details
- Seller and admin authorization for product management
- Integrates with AuthService for seller info

## Setup Instructions
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with:
   ```env
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   AUTH_SERVICE_URL=http://localhost:3001
   ```
3. Start the service:
   ```bash
   npm run dev
   ```

## Docker
Build and run with Docker:
```bash
docker build -t product-service . 
docker run -p 3002:3002 --env-file .env product-service
```

## API Endpoints
- `GET /products` — List all products
- `GET /products/:id` — Get product details
- `POST /products` — Create product (seller/admin)
- `PATCH /products/:id` — Update product (seller/admin)
- `DELETE /products/:id` — Delete product (seller/admin)

## Authentication
- Uses JWT for protected endpoints
- Only sellers and admins can manage products

## Dependencies
- express, mongoose, jsonwebtoken, axios, dotenv, cors

## Notes
- ProductService fetches seller info from AuthService for product listings

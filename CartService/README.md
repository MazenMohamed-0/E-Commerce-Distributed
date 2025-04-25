# CartService Directory Structure and Services

## Service Components

### Cart Management Service (`services/cartService.js`)
- Shopping cart CRUD operations
- Product validation with ProductService
- Cart total calculation
- Stock validation
- Multi-seller cart support

## Directory Structure
```
CartService/
├── middleware/         # Authentication middleware
├── models/            # Cart model definition
├── routes/            # Cart API routes
└── services/          # Cart service implementation
```

## Core Components

### Models (`models/Cart.js`)
- Cart schema definition
- Cart item subdocument schema
- Timestamps and user association
- Product reference management

### Routes (`routes/cartRoutes.js`)
- Cart CRUD endpoints
- Buyer authentication
- Request validation
- Error handling

### Middleware (`middleware/authMiddleware.js`)
- JWT validation
- Buyer role verification
- Request authentication

## Service Integration
CartService integrates with:
- AuthService for user authentication
- ProductService for product validation
- Frontend for cart management UI

## Cart Features
- Multiple items per cart
- Quantity management
- Stock validation
- Price calculation
- Multi-seller support
- Persistent storage

See the Setup Instructions and other details in the sections below for running the service.

## Setup Instructions
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with:
   ```env
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   PRODUCT_SERVICE_URL=http://localhost:3002
   ```
3. Start the service:
   ```bash
   npm run dev
   ```

## Docker
Build and run with Docker:
```bash
docker build -t cart-service . 
docker run -p 3003:3003 --env-file .env cart-service
```

## API Endpoints
- `GET /cart` — Get current user's cart
- `POST /cart` — Add item to cart
- `PUT /cart/:productId` — Update quantity
- `DELETE /cart/:productId` — Remove item
- `DELETE /cart` — Clear cart

## Authentication
- Uses JWT for API authentication
- Only buyers can access cart endpoints

## Dependencies
- express, mongoose, jsonwebtoken, axios, dotenv, cors

## Notes
- Cart items are validated against ProductService for existence and stock
- Requires AuthService for user authentication

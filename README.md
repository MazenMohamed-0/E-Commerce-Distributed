# 🛍️ E-Commerce Distributed System

[![Node.js](https://img.shields.io/badge/Node.js-v18-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-✓-blue)](https://www.docker.com/)
[![Microservices](https://img.shields.io/badge/Architecture-Microservices-orange)](https://microservices.io/)
[![OAuth](https://img.shields.io/badge/OAuth-Google%2FFacebook-green)](https://oauth.net/)

> A modern, scalable e-commerce platform built with microservices architecture

## 📋 Table of Contents
- [Project Structure](#-project-structure)
- [Architecture Overview](#-architecture-overview)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [API Documentation](#-api-documentation)

# 🛒 Distributed E-Commerce Microservices System

A scalable and modular e-commerce application built using Node.js, React, MongoDB, Docker, and Kubernetes. The system follows a microservices architecture and supports authentication, product management, order processing, cart management, and a React-based frontend.

## 📁 Project Structure

```bash
E-Commerce-Distributed/
├── .gitignore
├── docker-compose.yml
│
├── AuthService/          # 🔐 Authentication Service
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── .env
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   └── authRoutes.js
│   ├── services/
│   │   └── authService.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   └── strategies/       # OAuth strategies
│       ├── google.js
│       └── facebook.js
│
├── ProductService/       # 📦 Product Management Service
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── .env
│   ├── models/
│   │   ├── Product.js
│   │   └── Review.js
│   ├── routes/
│   │   └── productRoutes.js
│   ├── services/
│   │   └── productService.js
│   └── middleware/
│       └── authMiddleware.js
│
├── OrderService/         # 🛒 Order Processing Service
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── .env
│   ├── models/
│   │   └── Order.js
│   ├── routes/
│   │   └── orderRoutes.js
│   ├── services/
│   │   └── orderService.js
│   └── middleware/
│       └── authMiddleware.js
│
├── CartService/          # 🛒 Cart Management Service
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── .env
│   ├── models/
│   │   └── Cart.js
│   ├── routes/
│   │   └── cartRoutes.js
│   ├── services/
│   │   └── cartService.js
│   └── middleware/
│       └── authMiddleware.js
│
└── Frontend/            # 🖥️ React Frontend Application
    ├── .gitignore
    ├── Dockerfile
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── index.html
    ├── public/
    │   └── favicon.ico
    ├── src/
    │   ├── main.jsx              # Application entry point
    │   ├── App.jsx               # Root React component
    │   ├── api/                  # API endpoint configurations (if any)
    │   ├── assets/               # Static assets (images, fonts, etc.)
    │   ├── components/           # Reusable React components
    │   ├── context/              # React context providers (Auth, Cart, etc.)
    │   ├── pages/                # Page components (Home, Login, Register, etc.)
    │   ├── styles/               # Global styles
    │   └── config.js             # Configuration (API URLs, etc.)
    └── .vscode/                 # VS Code configuration
```

## 🏗️ Architecture Overview

The system follows a microservices architecture with the following components:

### Frontend 🖥️
- Single-page application built with React 18 + Vite
- Uses React Context for state management (Auth, Cart, etc.)
- Communicates with backend services through REST APIs
- Provides user interface for product browsing, ordering, and account management
- Includes social login integration (Google & Facebook)
- Organized with components, pages, and context for maintainability
- Modern UI with Material-UI (MUI)

### Backend Services

1. **AuthService** 🔐
   - Handles user authentication and authorization
   - Manages user accounts and sessions
   - Provides JWT-based security
   - Implements OAuth 2.0 with Google and Facebook
   - Follows MVC pattern with models, routes, and services

2. **ProductService** 📦
   - Manages product catalog
   - Handles product inventory
   - Provides product search and filtering capabilities
   - Implements product reviews and ratings
   - Organized with clear separation of concerns

3. **OrderService** 🛒
   - Processes customer orders
   - Manages order status and history
   - Handles payment processing
   - Implements order cancellation
   - Implements proper middleware for security

4. **CartService** 🛒
   - Manages user shopping carts
   - Handles adding, updating, and removing items from the cart
   - Provides endpoints to get, update, and clear the cart
   - Ensures cart is cleared after successful order

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern JavaScript UI library
- **Vite** - Fast build tool
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Material-UI (MUI)** - UI component library

### Backend Services
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **JWT** - Authentication
- **Passport.js** - OAuth authentication
- **Docker** - Containerization
- **Docker Compose** - Service orchestration

## 🚀 Getting Started

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/E-Commerce-Distributed.git
   cd E-Commerce-Distributed
   ```

2. Environment Setup
   ```bash
   # Copy environment files
   cp AuthService/.env.example AuthService/.env
   cp ProductService/.env.example ProductService/.env
   cp OrderService/.env.example OrderService/.env
   cp CartService/.env.example CartService/.env
   cp Frontend/.env.example Frontend/.env

   # Update OAuth credentials in AuthService/.env
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   FACEBOOK_APP_ID=your_facebook_app_id
   FACEBOOK_APP_SECRET=your_facebook_app_secret
   ```

## 🔑 Environment Variables

For proper configuration, each service relies on environment variables defined in `.env` files. The project now uses environment variables instead of hardcoded values.

### Using the Environment Generator Script

You can use the provided script to generate all required .env files:

```bash
node generate-env-files.js
```

This will create .env files for all services with default values. Remember to update sensitive values like JWT_SECRET, SESSION_SECRET, and OAuth credentials.

### Frontend Environment Variables
In `.env` file in the Frontend directory:
```
# Frontend Service (Vite uses VITE_ prefix)
VITE_BACKEND_URL=http://localhost:3001
VITE_PRODUCT_SERVICE_URL=http://localhost:3002
VITE_CART_SERVICE_URL=http://localhost:3003
VITE_ORDER_SERVICE_URL=http://localhost:3004
VITE_PAYMENT_SERVICE_URL=http://localhost:3005
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### Auth Service Environment Variables
In `.env` file in the AuthService directory:
```
AUTH_PORT=3001
AUTH_MONGODB_URI=mongodb://localhost:27017/auth
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### Product Service Environment Variables
In `.env` file in the ProductService directory:
```
PRODUCT_PORT=3002
PRODUCT_MONGODB_URI=mongodb://localhost:27017/product
```

### Cart Service Environment Variables
In `.env` file in the CartService directory:
```
CART_PORT=3003
CART_MONGODB_URI=mongodb://localhost:27017/cart
```

### Order Service Environment Variables
In `.env` file in the OrderService directory:
```
ORDER_PORT=3004
ORDER_MONGODB_URI=mongodb://localhost:27017/order
```

### Payment Service Environment Variables
In `.env` file in the PaymentService directory:
```
PAYMENT_PORT=3005
PAYMENT_MONGODB_URI=mongodb://localhost:27017/payment
STRIPE_PUBLIC_KEY=your_stripe_public_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

### Shared Environment Variables
These are common across all services:
```
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
RABBITMQ_URL=amqp://localhost:5672
```

3. Install dependencies
   ```bash
   # Install dependencies for all services
   cd AuthService && npm install
   cd ../ProductService && npm install
   cd ../OrderService && npm install
   cd ../CartService && npm install
   cd ../Frontend && npm install
   ```

4. Start the application
   ```bash
   # Start all services using Docker Compose
   docker-compose up --build
   ```

5. Access the application
   - Frontend: http://localhost:5173
   - Auth Service: http://localhost:3001
   - Product Service: http://localhost:3002
   - Order Service: http://localhost:3003
   - Cart Service: http://localhost:3004

## 📚 API Documentation

### Auth Service
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `GET /api/auth/users` - Get all users (admin only)
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/facebook` - Initiate Facebook OAuth flow
- `GET /api/auth/facebook/callback` - Facebook OAuth callback
- `POST /api/auth/link-social` - Link social account to existing user
- `POST /api/auth/unlink-social` - Unlink social account from user

### Product Service
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (admin only)
- `PATCH /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)
- `GET /api/products/search` - Search products
- `GET /api/products/category/:category` - Get products by category
- `POST /api/products/:id/reviews` - Add product review
- `GET /api/products/:id/reviews` - Get product reviews

### Order Service
- `GET /api/orders` - Get all orders (admin only)
- `GET /api/orders/my-orders` - Get user's orders
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:id/status` - Update order status (admin only)
- `DELETE /api/orders/:id` - Cancel order
- `GET /api/orders/:id` - Get order details

### Cart Service
- `GET /api/cart` - Get current user's cart
- `POST /api/cart` - Add item to cart
- `PUT /api/cart` - Update cart (e.g., change quantity)
- `DELETE /api/cart` - Clear cart
- `DELETE /api/cart/item/:itemId` - Remove a specific item from cart

## 💻 Development

Each service can be developed and deployed independently. The services communicate with each other through well-defined APIs, making the system scalable and maintainable. Each service follows a consistent structure with:

- **Models** 📊 - Data representation
- **Routes** 🛣️ - API endpoints
- **Services** ⚙️ - Business logic
- **Middleware** 🔒 - Cross-cutting concerns
- **Environment** ⚙️ - Configuration through .env files

### Running Services Individually
```bash
# Auth Service
cd AuthService && npm run dev

# Product Service
cd ProductService && npm run dev

# Order Service
cd OrderService && npm run dev

# Cart Service
cd CartService && npm run dev

# Frontend
cd Frontend && npm run dev
```

### Testing
```bash
# Run tests for each service
cd AuthService && npm test
cd ../ProductService && npm test
cd ../OrderService && npm test
cd ../CartService && npm test
cd ../Frontend && npm test
``` 

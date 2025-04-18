# 🛍️ E-Commerce Distributed System

[![Node.js](https://img.shields.io/badge/Node.js-v18-green)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3-blue)](https://vuejs.org/)
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
└── Frontend/            # 🖥️ Vue.js Frontend Application
    ├── .gitignore
    ├── Dockerfile
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── index.html
    ├── public/
    │   └── favicon.ico
    ├── src/
    │   ├── main.js              # Application entry point
    │   ├── App.vue              # Root Vue component
    │   ├── api/
    │   │   └── Endpoints.js     # API endpoint configurations
    │   ├── assets/              # Static assets (images, fonts, etc.)
    │   ├── components/          # Reusable Vue components
    │   │   ├── LoginForm.vue    # Login form component
    │   │   └── SocialLogin.vue  # Social login buttons
    │   ├── composables/         # Vue 3 composables
    │   │   └── useAuth.js       # Authentication composable
    │   ├── plugins/             # Vue plugins
    │   ├── router/
    │   │   └── index.js         # Vue Router configuration
    │   ├── stores/              # Pinia state management
    │   │   ├── User.js          # User state management
    │   │   └── Cart.js          # Shopping cart state
    │   ├── styles/              # Global styles
    │   └── views/               # Page components
    │       ├── Login.vue        # Login page view
    │       └── Profile.vue      # User profile view
    └── .vscode/                 # VS Code configuration
```

## 🏗️ Architecture Overview

The system follows a microservices architecture with the following components:

### Frontend 🖥️
- Single-page application built with Vue.js 3
- Uses Pinia for state management
- Implements Vue 3 Composition API
- Communicates with backend services through REST APIs
- Provides user interface for product browsing, ordering, and account management
- Includes social login integration (Google & Facebook)
- Organized with components, views, and services for better maintainability
- Includes testing setup for both unit and end-to-end tests

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

## 🛠️ Technology Stack

### Frontend
- **Vue.js 3** - Progressive JavaScript framework
- **Pinia** - State management
- **Vue Router** - Client-side routing
- **Axios** - HTTP client
- **Tailwind CSS** - Utility-first CSS framework
- **Vue 3 Composition API** - Composition-based API

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
   cp Frontend/.env.example Frontend/.env

   # Update OAuth credentials in AuthService/.env
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   FACEBOOK_APP_ID=your_facebook_app_id
   FACEBOOK_APP_SECRET=your_facebook_app_secret
   ```

3. Install dependencies
   ```bash
   # Install dependencies for all services
   npm run install-all
   ```

4. Start the application
   ```bash
   # Start all services using Docker Compose
   docker-compose up --build
   ```

5. Access the application
   - Frontend: http://localhost:8080
   - Auth Service: http://localhost:3000
   - Product Service: http://localhost:3001
   - Order Service: http://localhost:3002

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

# Frontend
cd Frontend && npm run serve
```

### Testing
```bash
# Run tests for each service
cd AuthService && npm test
cd ../ProductService && npm test
cd ../OrderService && npm test
cd ../Frontend && npm test
``` 
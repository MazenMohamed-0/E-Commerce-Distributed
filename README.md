# 🛍️ E-Commerce Distributed System

[![Node.js](https://img.shields.io/badge/Node.js-v18-green)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3-blue)](https://vuejs.org/)
[![Docker](https://img.shields.io/badge/Docker-✓-blue)](https://www.docker.com/)
[![Microservices](https://img.shields.io/badge/Architecture-Microservices-orange)](https://microservices.io/)

> A modern, scalable e-commerce platform built with microservices architecture

## 📋 Table of Contents
- [Project Structure](#-project-structure)
- [Architecture Overview](#-architecture-overview)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
- [Development](#-development)

# 🛒 Distributed E-Commerce Microservices System

A scalable and modular e-commerce application built using Node.js, Vue.js, MongoDB, Docker, and Kubernetes. The system follows a microservices architecture and supports authentication, product management, order processing, and a Vue-based frontend.

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
│   └── middleware/
│       └── authMiddleware.js
│
├── ProductService/       # 📦 Product Management Service
│   ├── .gitignore
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── .env
│   ├── models/
│   │   └── Product.js
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
    ├── .env
    ├── public/
    │   ├── index.html
    │   └── favicon.ico
    ├── src/
    │   ├── main.js
    │   ├── App.vue
    │   ├── router/
    │   │   └── index.js
    │   ├── store/
    │   │   └── index.js
    │   ├── components/
    │   │   ├── auth/
    │   │   │   ├── Login.vue
    │   │   │   └── Register.vue
    │   │   ├── products/
    │   │   │   ├── ProductList.vue
    │   │   │   └── ProductDetail.vue
    │   │   └── orders/
    │   │       ├── OrderList.vue
    │   │       └── OrderDetail.vue
    │   ├── views/
    │   │   ├── Home.vue
    │   │   ├── Products.vue
    │   │   ├── Cart.vue
    │   │   └── Profile.vue
    │   ├── services/
    │   │   ├── authService.js
    │   │   ├── productService.js
    │   │   └── orderService.js
    │   └── assets/
    │       ├── styles/
    │       │   └── main.css
    │       └── images/
    └── tests/
        ├── unit/
        └── e2e/
```

## 🏗️ Architecture Overview

The system follows a microservices architecture with the following components:

### Frontend 🖥️
- Single-page application built with Vue.js
- Communicates with backend services through REST APIs
- Provides user interface for product browsing, ordering, and account management
- Organized with components, views, and services for better maintainability
- Includes testing setup for both unit and end-to-end tests

### Backend Services

1. **AuthService** 🔐
   - Handles user authentication and authorization
   - Manages user accounts and sessions
   - Provides JWT-based security
   - Follows MVC pattern with models, routes, and services

2. **ProductService** 📦
   - Manages product catalog
   - Handles product inventory
   - Provides product search and filtering capabilities
   - Organized with clear separation of concerns

3. **OrderService** 🛒
   - Processes customer orders
   - Manages order status and history
   - Handles payment processing
   - Implements proper middleware for security

## 🛠️ Technology Stack

### Frontend
- **Vue.js** - Progressive JavaScript framework
- **Vuex** - State management
- **Vue Router** - Client-side routing
- **Axios** - HTTP client

### Backend Services
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **JWT** - Authentication
- **Docker** - Containerization
- **Docker Compose** - Service orchestration

## 🚀 Getting Started

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/E-Commerce-Distributed.git
   cd E-Commerce-Distributed
   ```

2. Install dependencies
   ```bash
   # Install dependencies for all services
   npm run install-all
   ```

3. Start the application
   ```bash
   # Start all services using Docker Compose
   docker-compose up
   ```

4. Access the application
   - Frontend: http://localhost:3000
   - Auth Service: http://localhost:3001
   - Product Service: http://localhost:3002
   - Order Service: http://localhost:3003

## 💻 Development

Each service can be developed and deployed independently. The services communicate with each other through well-defined APIs, making the system scalable and maintainable. Each service follows a consistent structure with:

- **Models** 📊 - Data representation
- **Routes** 🛣️ - API endpoints
- **Services** ⚙️ - Business logic
- **Middleware** 🔒 - Cross-cutting concerns
- **Environment** ⚙️ - Configuration through .env files


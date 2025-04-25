# AuthService Directory Structure and Services

## Service Components

### Authentication Services (`services/authService.js`)
- Handles user registration and login
- Manages JWT token generation and verification
- Processes OAuth authentication (Google, Facebook)
- Handles role updates for OAuth users

### User Management Services (`services/userService.js`)
- User CRUD operations
- Role-based access control
- Permission validation
- User status management

### Passport Service (`services/passport.js`)
- OAuth strategy configuration
- Google OAuth implementation
- Facebook OAuth implementation
- Session serialization/deserialization

### Buyer Service (`services/buyerService.js`)
- Buyer-specific operations
- Shipping address management
- Buyer profile management

### Seller Service (`services/sellerService.js`)
- Seller registration and approval workflow
- Store information management
- Seller status updates
- Store profile management

## Directory Structure
```
AuthService/
├── middleware/         # Authentication middleware
├── models/            # Database models (User, Admin, Buyer, Seller)
├── public/            # OAuth test pages and data deletion
├── routes/            # API route definitions
└── services/          # Core service implementations
```

## Core Models
- `User.js`: Base user model
- `Admin.js`: Admin-specific model
- `Buyer.js`: Buyer-specific model
- `Seller.js`: Seller-specific model with store info

## API Routes
- `authRoutes.js`: Authentication endpoints
- `user.js`: User management endpoints

## Middleware
- JWT verification
- Role-based access control
- Admin authorization

## Service Integration
This service is the central authentication hub for:
- Frontend client
- ProductService
- CartService

See the Setup Instructions and other details in the sections below for running the service.

## Overview
AuthService is responsible for user authentication, registration, and user management in a microservices-based e-commerce platform. It supports multiple user roles (admin, buyer, seller), OAuth login (Google, Facebook), and seller approval workflows.

## Features
- User registration and login (email/password, Google, Facebook)
- Role-based access: admin, buyer, seller
- Seller application and approval process
- JWT-based authentication
- Admin dashboard endpoints
- Data deletion endpoint for Facebook compliance

## Setup Instructions
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with:
   ```env
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   SESSION_SECRET=your_session_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   FACEBOOK_APP_ID=your_facebook_app_id
   FACEBOOK_APP_SECRET=your_facebook_app_secret
   ADMIN_SECRET_KEY=your_admin_secret_key
   ```
3. Start the service:
   ```bash
   npm run dev
   ```

## Docker
Build and run with Docker:
```bash
docker build -t auth-service . 
docker run -p 3001:3001 --env-file .env auth-service
```

## API Endpoints
- `POST /auth/register` — Register user (buyer/seller)
- `POST /auth/login` — Login
- `GET /auth/google` — Google OAuth
- `GET /auth/facebook` — Facebook OAuth
- `GET /auth/profile` — Get user profile (JWT required)
- `POST /auth/update-role` — Update user role (OAuth users)
- `POST /auth/data-deletion` — Facebook data deletion
- `GET /users` — List users (admin)
- `PUT /users/:id` — Update user
- `DELETE /users/:id` — Delete user

## Authentication
- Uses JWT for API authentication
- OAuth via Google and Facebook
- Role-based middleware for admin/seller/buyer

## Dependencies
- express, mongoose, jsonwebtoken, passport, passport-google-oauth20, passport-facebook, bcryptjs, dotenv, cors

## Notes
- Seller accounts require admin approval before activation
- Admin creation requires a secret key
- See `public/test.html` for OAuth login test UI

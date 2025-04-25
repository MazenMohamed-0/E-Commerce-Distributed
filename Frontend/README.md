# Frontend Directory Structure and Components

## Component Organization

### Core Components (`src/components/`)
#### Authentication
- `OAuthPopup.jsx`: OAuth authentication window
- `PrivateRoute.jsx`: Protected route wrapper

#### Layout
- `Navbar.jsx`: Main navigation bar

#### Admin Dashboard (`components/AdminDashboard/`)
- `DashboardOverview.jsx`: Admin statistics and overview
- `UserManagement.jsx`: User administration interface

#### Cart Components (`components/Cart/`)
- `CartItem.jsx`: Individual cart item display
- `CartSummary.jsx`: Cart totals and checkout
- `EmptyCart.jsx`: Empty cart state

#### Product Components (`components/Product/`)
- `ProductCard.jsx`: Product display card
- `ProductGrid.jsx`: Product listing grid
- `ProductImage.jsx`: Product image handling
- `ProductInfo.jsx`: Product details display

#### Seller Components (`components/Seller/`)
- `ProductManagement.jsx`: Seller product CRUD
- `SellerProducts.jsx`: Seller product listing

### Pages (`src/pages/`)
- `Home.jsx`: Landing page
- `Login.jsx`: User login
- `Register.jsx`: User registration
- `Cart.jsx`: Shopping cart
- `ProductDetails.jsx`: Product details
- `SelectRole.jsx`: Role selection
- Admin and Seller dashboards

### Context (`src/context/`)
- `AuthContext.jsx`: Authentication state
- `CartContext.jsx`: Shopping cart state
- `hooks.js`: Custom React hooks

## Directory Structure
```
Frontend/
├── public/            # Static assets
├── src/
│   ├── assets/        # Application assets
│   ├── components/    # Reusable components
│   ├── context/       # React context providers
│   ├── pages/         # Page components
│   └── config.js      # Configuration
```

## Component Features
- Material-UI integration
- Responsive design
- Role-based component rendering
- Protected routes
- State management via Context
- Service integration

See the Setup Instructions and other details in the sections below for running the frontend.

## Setup Instructions
1. Install dependencies:
   ```bash
   npm install
   ```
2. Update `src/config.js` if backend service URLs differ from default:
   ```js
   const config = {
     BACKEND_URL: 'http://localhost:3001',
     PRODUCT_SERVICE_URL: 'http://localhost:3002',
     CART_SERVICE_URL: 'http://localhost:3003',
   };
   export default config;
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Authentication
- Uses JWT stored in localStorage
- OAuth via Google and Facebook
- Role-based routing and access control

## Dependencies
- react, react-router-dom, @mui/material, axios, vite

## Notes
- Requires AuthService, ProductService, and CartService to be running
- For OAuth, set up Google and Facebook credentials in AuthService

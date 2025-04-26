import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

// Pages
import { Login } from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Home from './pages/Home.jsx';
import AdminHome from './pages/Admin/AdminHome.jsx';
import OAuthPopup from './components/OAuthPopup.jsx';
import OAuthCallback from './pages/OAuthCallback.jsx';
import SelectRole from './pages/SelectRole';
import PrivateRoute from './components/PrivateRoute';
import SellerDashboard from './pages/Seller/SellerDashboard';
import ProductDetails from './pages/ProductDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import MyOrders from './pages/MyOrders';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <CartProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/oauth-callback" element={<OAuthCallback />} />
            <Route path="/select-role" element={<SelectRole />} />
            <Route path="/" element={<Home />} />
            <Route path="/cart" element={<Cart />} />
            <Route 
              path="/checkout" 
              element={
                <PrivateRoute requireBuyer={true}>
                  <Checkout />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/order-confirmation/:orderId" 
              element={
                <PrivateRoute requireBuyer={true}>
                  <OrderConfirmation />
                </PrivateRoute>
              } 
            />
            <Route
              path="/admin"
              element={
                <PrivateRoute requireAdmin={true}>
                  <AdminHome />
                </PrivateRoute>
              }
            />
            <Route
              path="/seller"
              element={
                <PrivateRoute requireSeller={true}>
                  <SellerDashboard />
                </PrivateRoute>
              }
            />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route 
              path="/my-orders" 
              element={
                <PrivateRoute requireBuyer={true}>
                  <MyOrders />
                </PrivateRoute>
              } 
            />
          </Routes>
        </Router>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { lightTheme, darkTheme } from './config/theme';
import Navbar from './components/Navbar';

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
import OrderDetails from './pages/OrderDetails';
import LandingPage from './pages/LandingPage';

function App() {

  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode((prevMode) => !prevMode);
  };

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <CssBaseline />
      <AuthProvider>
        <CartProvider>
          <Router>
          <Navbar isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/oauth-callback" element={<OAuthCallback />} />
              <Route path="/select-role" element={<SelectRole />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
              <Route path="/my-orders" element={<MyOrders />} />
              <Route path="/order/:id" element={<OrderDetails />} />
              <Route
                path="/admin/*"
                element={
                  <PrivateRoute>
                    <AdminHome />
                  </PrivateRoute>
                }
              />
              <Route
                path="/seller/*"
                element={
                  <PrivateRoute requireSeller>
                    <SellerDashboard />
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
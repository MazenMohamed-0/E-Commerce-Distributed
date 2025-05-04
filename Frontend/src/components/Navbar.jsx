import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Typography,
  Badge,
  IconButton
} from '@mui/material';
import { ShoppingCart, ShoppingBag, Person } from '@mui/icons-material';
import { useAuth } from '../context/hooks';
import { useCart } from '../context/CartContext';

const Navbar = ({ hideCartIcon }) => {
  const { user, logout } = useAuth();
  const { getCartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = React.useState(null);

  // Check if we're on the cart page
  const isCartPage = location.pathname === '/cart';
  // Only hide cart icon if explicitly requested or if we're on the cart page
  const shouldHideCartIcon = hideCartIcon || isCartPage;

  const handleProfileClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    handleClose();
  };

  // Check if user is a seller
  const isSeller = user && user.role === 'seller';

  return (
    <AppBar position="static" sx={{ backgroundColor: '#1976d2' }}>
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1, cursor: 'pointer', fontWeight: 'bold' }}
          onClick={() => navigate('/')}
        >
          E-Commerce
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Shopping Cart - Always visible for non-sellers EXCEPT on cart page */}
          {!isSeller && !shouldHideCartIcon && (
            <IconButton 
              color="inherit"
              onClick={() => navigate('/cart')}
              sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                padding: '8px',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }
              }}
            >
              <Badge 
                badgeContent={getCartCount()} 
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.75rem',
                    height: '20px',
                    minWidth: '20px',
                    padding: '0 4px',
                    backgroundColor: '#ff3d00',
                  }
                }}
              >
                <ShoppingCart />
              </Badge>
            </IconButton>
          )}

          {/* User Profile Icon */}
          <IconButton 
            color="inherit"
            sx={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              padding: '8px',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              }
            }}
            onClick={user ? handleProfileClick : () => navigate('/login')}
          >
            {user ? (
              <Avatar
                src={user?.picture || user?.avatar}
                sx={{ width: 28, height: 28 }}
                alt={user.name}
              />
            ) : (
              <Person />
            )}
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleClose(); }}>Profile</MenuItem>
            {user && user.role === 'buyer' && (
              <MenuItem onClick={() => { navigate('/my-orders'); handleClose(); }}>My Orders</MenuItem>
            )}
            {user && user.role === 'seller' && (
              <MenuItem onClick={() => { navigate('/seller-dashboard'); handleClose(); }}>Seller Dashboard</MenuItem>
            )}
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar; 
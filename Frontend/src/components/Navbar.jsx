import React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ShoppingCart, ShoppingBag } from '@mui/icons-material';
import { useAuth } from '../context/hooks';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { getCartCount } = useCart();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState(null);

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
    <AppBar position="static">
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          E-Commerce
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Only show cart for non-sellers */}
          {!isSeller && (
            <IconButton 
              color="inherit"
              onClick={() => navigate('/cart')}
            >
              <Badge badgeContent={getCartCount()} color="error">
                <ShoppingCart />
              </Badge>
            </IconButton>
          )}

          {user && (
            <IconButton 
              color="inherit"
              onClick={() => navigate('/my-orders')}
              title="My Orders"
            >
              <ShoppingBag />
            </IconButton>
          )}

          {user ? (
            <>
              <Avatar
                src={user?.picture || user?.avatar}
                onClick={handleProfileClick}
                sx={{ cursor: 'pointer' }}
              />
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button color="inherit" onClick={() => navigate('/login')}>
                Login
              </Button>
              <Button color="inherit" onClick={() => navigate('/register')}>
                Sign Up
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar; 
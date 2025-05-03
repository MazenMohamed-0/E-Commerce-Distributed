import React, { useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import CartItem from '../components/Cart/CartItem';
import EmptyCart from '../components/Cart/EmptyCart';

const Cart = () => {
  const navigate = useNavigate();
  const { cartItems, getTotal } = useCart();
  const { user } = useAuth();

  // Redirect sellers away from cart page
  useEffect(() => {
    if (user && user.role === 'seller') {
      navigate('/');
    }
  }, [user, navigate]);

  if (!cartItems || cartItems.length === 0) {
    return <EmptyCart />;
  }

  const total = getTotal();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Shopping Cart
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          {cartItems.map((item) => (
            <CartItem key={item.productId} item={item} />
          ))}
        </Box>

        <Paper sx={{ p: 3, width: 300, height: 'fit-content' }}>
          <Typography variant="h6" gutterBottom>
            Order Summary
          </Typography>
          
          <Box sx={{ my: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Subtotal</Typography>
              <Typography>${total.toFixed(2)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Shipping</Typography>
              <Typography>Free</Typography>
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6">${total.toFixed(2)}</Typography>
          </Box>

          <Button
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            onClick={() => navigate('/checkout')}
          >
            Proceed to Checkout
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default Cart; 
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button,
  Alert
} from '@mui/material';
import { Cancel } from '@mui/icons-material';

const PaymentCancel = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Clean up localStorage
    localStorage.removeItem('pendingOrderId');
    localStorage.removeItem('pendingPaymentId');
  }, []);

  const handleBackToCheckout = () => {
    navigate('/checkout');
  };

  const handleContinueShopping = () => {
    navigate('/');
  };

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Cancel color="error" sx={{ fontSize: 80, mb: 3 }} />
          <Typography variant="h4" gutterBottom>
            Payment Cancelled
          </Typography>
          <Alert severity="info" sx={{ mb: 3, width: '100%' }}>
            Your payment has been cancelled. No charges were made.
          </Alert>
          <Typography variant="body1" sx={{ mb: 4 }}>
            You can try again or choose a different payment method.
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button variant="contained" color="primary" onClick={handleBackToCheckout}>
              Back to Checkout
            </Button>
            <Button variant="outlined" onClick={handleContinueShopping}>
              Continue Shopping
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentCancel; 
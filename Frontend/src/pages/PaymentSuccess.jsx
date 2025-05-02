import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Button, 
  CircularProgress, 
  Alert,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { CheckCircle, Error, Replay } from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// Saga steps for visualization
const sagaSteps = [
  'Order Created',
  'Stock Validated',
  'Payment Processing',
  'Payment Completed',
  'Order Completed'
];

const PaymentSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [activeStep, setActiveStep] = useState(2); // Default to payment processing step
  const [polling, setPolling] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Function to poll order status
  const pollOrderStatus = async (orderId) => {
    if (!orderId || !token) return;
    
    try {
      const response = await axios.get(
        `http://localhost:3004/orders/${orderId}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setOrderStatus(response.data);
      
      // Update active step based on status
      switch(response.data.status) {
        case 'pending':
          setActiveStep(0);
          break;
        case 'stock_validated':
          setActiveStep(1);
          break;
        case 'payment_pending':
          setActiveStep(2);
          break;
        case 'payment_completed':
          setActiveStep(3);
          break;
        case 'completed':
          setActiveStep(4);
          setSuccess(true);
          clearInterval(polling);
          await clearCart();
          // Clear localStorage to prevent duplicate processing
          localStorage.removeItem('pendingOrderId');
          localStorage.removeItem('checkoutIdempotencyKey');
          break;
        case 'failed':
          setError(response.data.message || 
                  (response.data.error && response.data.error.message) || 
                  'Order processing failed');
          clearInterval(polling);
          break;
        default:
          // Keep current step for unknown status
      }
    } catch (err) {
      console.error('Error polling order status:', err);
      setRetryCount(prev => prev + 1);
      
      // Stop polling after too many errors
      if (retryCount > 5) {
        clearInterval(polling);
        setError('Error checking order status. Please check your orders page.');
      }
    }
  };

  useEffect(() => {
    const processPayment = async () => {
      try {
        setLoading(true);
        
        // Get PayPal params from URL
        const params = new URLSearchParams(location.search);
        const paymentId = params.get('paymentId');
        const payerId = params.get('PayerID');
        
        // Get orderId from URL or localStorage
        const orderId = params.get('orderId') || localStorage.getItem('pendingOrderId');
        
        console.log('Payment completion data:', { paymentId, payerId, orderId });
        
        if (!paymentId || !payerId || !orderId) {
          throw new Error('Missing payment information');
        }
        
        if (!token) {
          throw new Error('You must be logged in to complete payment');
        }
        
        // Execute payment
        const response = await axios.post(
          `http://localhost:3004/orders/${orderId}/payment/execute`,
          { paymentId, payerId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log('Payment execution response:', response.data);
        
        setOrderId(orderId);
        
        // Start polling for order status updates
        const interval = setInterval(() => pollOrderStatus(orderId), 2000);
        setPolling(interval);
        
      } catch (err) {
        console.error('Error processing payment:', err);
        setSuccess(false);
        setError(err.response?.data?.message || err.message || 'Payment processing failed');
        
        // If we have an orderId in the URL or localStorage, we should still set it
        // so the user can click "View Order" to see details
        const params = new URLSearchParams(location.search);
        const orderId = params.get('orderId') || localStorage.getItem('pendingOrderId');
        if (orderId) {
          setOrderId(orderId);
        }
      } finally {
        setLoading(false);
      }
    };
    
    // Only process if we have query parameters
    if (location.search) {
      processPayment();
    } else {
      // If no query parameters, redirect to home
      setLoading(false);
      setError('Invalid payment callback. Redirecting to home...');
      setTimeout(() => navigate('/'), 3000);
    }
    
    // Cleanup polling on unmount
    return () => {
      if (polling) {
        clearInterval(polling);
      }
    };
  }, [location, navigate, token, clearCart]);
  
  const handleViewOrder = () => {
    navigate(`/orders/${orderId}`);
  };
  
  const handleContinueShopping = () => {
    navigate('/');
  };
  
  const handleRetry = () => {
    // Clear the pending order ID to force a new order
    localStorage.removeItem('pendingOrderId');
    localStorage.removeItem('checkoutIdempotencyKey');
    // Redirect back to checkout to try again
    navigate('/checkout');
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5">Processing your payment...</Typography>
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Please don't close this page
            </Typography>
          </Box>
        ) : success ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CheckCircle color="success" sx={{ fontSize: 80, mb: 3 }} />
            <Typography variant="h4" gutterBottom>
              Payment Successful!
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, textAlign: 'center' }}>
              Your order has been placed and payment has been received.
              The items will be shipped soon!
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button variant="contained" color="primary" onClick={handleViewOrder}>
                View Order
              </Button>
              <Button variant="outlined" onClick={handleContinueShopping}>
                Continue Shopping
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {error ? (
              <>
                <Error color="error" sx={{ fontSize: 80, mb: 3 }} />
                <Typography variant="h4" gutterBottom>
                  Payment Failed
                </Typography>
                <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
                  {error || 'There was an error processing your payment. Please try again.'}
                </Alert>
              </>
            ) : (
              <>
                <Typography variant="h5" gutterBottom>
                  Order Processing
                </Typography>
                <Box sx={{ width: '100%', mb: 4 }}>
                  <Stepper activeStep={activeStep} alternativeLabel>
                    {sagaSteps.map((label) => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Box>
                {orderStatus && (
                  <Alert severity="info" sx={{ mb: 3, width: '100%' }}>
                    {orderStatus.message || `Status: ${orderStatus.status}`}
                  </Alert>
                )}
              </>
            )}
            
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleRetry}
                startIcon={<Replay />}
              >
                Try Again
              </Button>
              <Button variant="outlined" onClick={handleContinueShopping}>
                Continue Shopping
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default PaymentSuccess; 
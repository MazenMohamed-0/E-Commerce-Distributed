import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Grid,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormLabel,
  Divider,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const steps = ['Shipping Information', 'Payment Method', 'Review Order'];

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, getTotal, clearCart } = useCart();
  const { user, token } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [orderPolling, setOrderPolling] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [pollingCount, setPollingCount] = useState(0);

  // Redirect to cart if cart is empty
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) {
      navigate('/cart');
    }
  }, [cartItems, navigate]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user || !token) {
      navigate('/login', { state: { from: '/checkout' } });
    }
  }, [user, token, navigate]);

  // New function to generate idempotency key
  const generateIdempotencyKey = () => {
    // If we already have one in localStorage, use it for retries
    const existingKey = localStorage.getItem('checkoutIdempotencyKey');
    if (existingKey) return existingKey;
    
    // Otherwise generate a new one - simple implementation
    const key = 'order-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('checkoutIdempotencyKey', key);
    return key;
  };
  
  // New function to poll order status
  const pollOrderStatus = async (orderId) => {
    if (!orderId || !token) return;
    
    try {
      const response = await axios.get(
        `http://localhost:3004/orders/${orderId}/status`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      setOrderStatus(response.data);
      
      // Handle different status cases
      switch(response.data.status) {
        case 'payment_pending':
          // Check if we have a payment URL in the payment object
          if (response.data.paymentUrl || 
             (response.data.payment && response.data.payment.paymentUrl)) {
            // Store order info and redirect to PayPal
            localStorage.setItem('pendingOrderId', orderId);
            window.location.href = response.data.paymentUrl || response.data.payment.paymentUrl;
            clearInterval(orderPolling);
            return;
          }
          break;
          
        case 'completed':
          // Success! Clear cart and redirect
          setSuccess('Order completed successfully!');
          clearCart();
          clearInterval(orderPolling);
          navigate('/orders/' + orderId);
          return;
          
        case 'failed':
          // Order failed
          setError(response.data.message || 
                  (response.data.error && response.data.error.message) || 
                  'Order processing failed');
          clearInterval(orderPolling);
          return;
          
        default:
          // Keep polling for other statuses
          setPollingCount(prev => prev + 1);
          
          // Stop polling after 30 attempts (approximately 1 minute with 2s interval)
          if (pollingCount > 30) {
            clearInterval(orderPolling);
            setError('Order processing is taking longer than expected. Please check order status page.');
            navigate('/orders');
          }
      }
    } catch (err) {
      console.error('Error polling order status:', err);
      setPollingCount(prev => prev + 1);
      
      // Stop polling after too many errors
      if (pollingCount > 5) {
        clearInterval(orderPolling);
        setError('Error checking order status. Please check your orders page.');
      }
    }
  };
  
  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (orderPolling) {
        clearInterval(orderPolling);
      }
    };
  }, [orderPolling]);

  const handleNext = () => {
    // Validate current step
    if (activeStep === 0 && !shippingAddress.trim()) {
      setError('Please enter your shipping address');
      return;
    }

    if (activeStep === steps.length - 1) {
      // Submit order
      handleSubmitOrder();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmitOrder = async () => {
    setLoading(true);
    setError('');

    try {
      // Check if token exists
      if (!token) {
        throw new Error('You must be logged in to place an order');
      }

      // Generate idempotency key for this checkout session
      const idempotencyKey = generateIdempotencyKey();

      // Prepare order data
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.productId,
          sellerId: item.sellerId, 
          quantity: item.quantity,
          price: item.price
        })),
        shippingAddress,
        paymentMethod: paymentType
      };

      console.log('Submitting order with data:', orderData);

      // Submit order to Order Service with idempotency key
      const response = await axios.post(
        'http://localhost:3004/orders',
        orderData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Idempotency-Key': idempotencyKey
          }
        }
      );

      console.log('Order creation response:', response.data);
      
      // Show initial status
      setOrderStatus(response.data);
      
      // Start polling for order status updates
      const orderId = response.data.orderId;
      if (orderId) {
        // Set up polling interval (every 2 seconds)
        const interval = setInterval(() => pollOrderStatus(orderId), 2000);
        setOrderPolling(interval);
        
        // Show processing status
        setSuccess('Order created! Processing your order...');
        
        // Set activeStep to a new "processing" step
        setActiveStep(steps.length); // This will show our custom processing step
      } else {
        throw new Error('No order ID received from server');
      }
    } catch (err) {
      console.error('Error creating order:', err);
      // Check if this was a duplicate order (already exists with same idempotency key)
      if (err.response?.status === 200 && err.response?.data?.order) {
        setSuccess('Order already exists! Redirecting to order status...');
        navigate(`/orders/${err.response.data.order._id}`);
        return;
      }
      
      setError(err.response?.data?.message || 'Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderShippingForm = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Shipping Address
      </Typography>
      <TextField
        required
        fullWidth
        multiline
        rows={4}
        label="Full Address"
        value={shippingAddress}
        onChange={(e) => setShippingAddress(e.target.value)}
        placeholder="Street, City, State, ZIP Code, Country"
        sx={{ mb: 2 }}
      />
    </Box>
  );

  const renderPaymentForm = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Payment Method
      </Typography>
      <FormControl component="fieldset">
        <FormLabel component="legend">Select Payment Method</FormLabel>
        <RadioGroup
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
        >
          <FormControlLabel value="cash" control={<Radio />} label="Cash on Delivery" />
          <FormControlLabel value="paypal" control={<Radio />} label="PayPal" />
        </RadioGroup>
      </FormControl>
    </Box>
  );

  const renderOrderSummary = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Order Summary
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        {cartItems.map((item) => (
          <Box key={item.productId} sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="body1">{item.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Qty: {item.quantity}
              </Typography>
            </Box>
            <Typography>${(item.price * item.quantity).toFixed(2)}</Typography>
          </Box>
        ))}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6">Total</Typography>
          <Typography variant="h6">${getTotal().toFixed(2)}</Typography>
        </Box>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Shipping Details
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography>{shippingAddress}</Typography>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Payment Method
      </Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography>{paymentType === 'cash' ? 'Cash on Delivery' : 'PayPal'}</Typography>
      </Paper>
    </Box>
  );

  // Add a new render function for the processing step
  const renderProcessingStep = () => (
    <Box sx={{ mt: 4, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        Processing Your Order
      </Typography>
      
      {orderStatus ? (
        <Alert severity={orderStatus.status === 'failed' ? 'error' : 'info'} sx={{ mb: 3 }}>
          {orderStatus.message || `Status: ${orderStatus.status}`}
        </Alert>
      ) : (
        <CircularProgress sx={{ my: 3 }} />
      )}
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Please wait while we process your order. This page will update automatically.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Button 
        variant="outlined" 
        onClick={() => navigate('/orders')}
        sx={{ mt: 2 }}
      >
        View All Orders
      </Button>
    </Box>
  );

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderShippingForm();
      case 1:
        return renderPaymentForm();
      case 2:
        return renderOrderSummary();
      case 3: // New processing step
        return renderProcessingStep();
      default:
        return 'Unknown step';
    }
  };

  if (!cartItems || cartItems.length === 0) {
    return null; // Will redirect in useEffect
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom align="center">
        Checkout
      </Typography>
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {getStepContent(activeStep)}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          disabled={activeStep === 0 || loading}
          onClick={handleBack}
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleNext}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={24} />
          ) : activeStep === steps.length - 1 ? (
            'Place Order'
          ) : (
            'Next'
          )}
        </Button>
      </Box>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="success" 
          variant="filled"
          sx={{ 
            width: '100%', 
            fontSize: '1.1rem', 
            backgroundColor: 'success.main',
            '& .MuiAlert-icon': {
              fontSize: '1.5rem'
            }
          }}
        >
          {success}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Checkout;

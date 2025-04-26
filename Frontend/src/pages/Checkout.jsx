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
  const [success, setSuccess] = useState(false);

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

      console.log('Using token for order submission:', token ? 'Token exists' : 'No token');

      // Prepare order data
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: getTotal(),
        shippingAddress,
        paymentType,
        paymentStatus: 'pending'
      };

      console.log('Submitting order with data:', orderData);

      // Submit order to Order Service
      const response = await axios.post(
        'http://localhost:3004/orders',
        orderData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('Order creation successful:', response.data);

      // Order successfully created
      setSuccess(true);
      
      // Clear the cart locally - handle the async function properly
      try {
        await clearCart();
        console.log('Cart cleared successfully');
      } catch (cartError) {
        console.error('Error clearing cart:', cartError);
        // Don't fail the order if cart clearing fails
      }
      
      // Navigate to order confirmation after a short delay
      setTimeout(() => {
        navigate(`/order-confirmation/${response.data._id}`);
      }, 2000);
    } catch (err) {
      console.error('Error creating order:', err);
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
          <FormControlLabel value="online payment" control={<Radio />} label="Online Payment" />
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
        <Typography>{paymentType === 'cash' ? 'Cash on Delivery' : 'Online Payment'}</Typography>
      </Paper>
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
        open={success}
        autoHideDuration={6000}
        onClose={() => setSuccess(false)}
      >
        <Alert severity="success">
          Order placed successfully! Redirecting to confirmation...
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Checkout;

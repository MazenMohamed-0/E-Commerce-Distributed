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
import OrderProcessingStatus from '../components/OrderProcessingStatus';
import config from '../config';

const steps = ['Shipping Information', 'Payment Method', 'Review Order'];

const Checkout = () => {
  const navigate = useNavigate();
  const { cartItems, getTotal, clearCart } = useCart();
  const { user, token } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [shippingAddress, setShippingAddress] = useState({
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phoneNumber: ''
  });
  const [paymentType, setPaymentType] = useState('stripe');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentActions, setPaymentActions] = useState(null);

  // Add a new effect to clear idempotency key when component mounts
  useEffect(() => {
    // Clear any existing idempotency key when the checkout page is loaded
    localStorage.removeItem('checkoutIdempotencyKey');
  }, []); // Empty dependency array means this runs once when component mounts

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
    if (activeStep === 0) {
      const requiredFields = ['fullName', 'addressLine1', 'city', 'state', 'postalCode', 'country', 'phoneNumber'];
      const missingFields = requiredFields.filter(field => !shippingAddress[field]);
      
      if (missingFields.length > 0) {
        setError(`Please complete all required shipping information: ${missingFields.join(', ')}`);
        return;
      }
    }

    if (activeStep === steps.length - 1) {
      // Submit order
      handlePlaceOrder();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handlePlaceOrder = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setPaymentActions(null);
      
      // Basic validation
      if (!shippingAddress.fullName || !shippingAddress.addressLine1 || !shippingAddress.city) {
        setError('Please fill in all required shipping information');
        setLoading(false);
        return;
      }
      
      if (cartItems.length === 0) {
        setError('Your cart is empty');
        setLoading(false);
        return;
      }
      
      console.log('DEBUG: Starting order placement process...');
      console.log('DEBUG: Payment method selected:', paymentType);
      
      // Show feedback for payment method
      if (paymentType === 'stripe') {
        setSuccess('Preparing Stripe payment...');
      } else if (paymentType === 'cash') {
        setSuccess('Processing cash on delivery order...');
      }
      
      // Create order with simple direct approach
      const orderData = {
        items: cartItems.map(item => ({
          ...item,
          productName: item.productName || item.name || 'Product',
          sellerId: item.sellerId || item.createdBy || 'unknown-seller'
        })),
        shippingAddress: shippingAddress,
        paymentMethod: paymentType,
        totalAmount: getTotal()
      };
      
      // Replace this console.log that shows all order data including payment info
      console.log('DEBUG: Submitting order with data:', {
        items: orderData.items.length,
        shippingAddress: "{ address data }",
        paymentMethod: orderData.paymentMethod,
        totalAmount: orderData.totalAmount
      });
      
      try {
        console.log('DEBUG: Sending order creation request to API...');
        const response = await axios.post(
          `${config.ORDER_SERVICE_URL || 'http://localhost:3004'}/orders`,
          orderData,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            timeout: 45000 // 45 second timeout
          }
        );
        
        console.log('DEBUG: Order API response received:', response.data);
        
        // Replace this console.log that shows Stripe payment response
        console.log('DEBUG: Order created successfully:', {
          orderId: response.data.orderId,
          status: response.data.status,
          paymentDetails: response.data.stripeClientSecret ? 'Has client secret' : 'No client secret'
        });
        
        if (response.data && response.data.orderId) {
          // For online payment, redirect to processing page
          if (paymentType === 'stripe') {
            console.log('DEBUG: Checking Stripe payment details in response...');
            if (response.data.stripeClientSecret) {
              console.log('DEBUG: Stripe client secret received, redirecting to processing page');
              // Clear success message
              setSuccess('');
              // If we got a client secret directly, navigate to processing order
              navigate(`/processing-order/${response.data.orderId}`);
            } else {
              console.log('DEBUG: No Stripe client secret in response, showing error');
              // If stripe payment is selected but no client secret, show error
              setError('Unable to process Stripe payment. Please try again or choose a different payment method.');
              setLoading(false);
            }
          } else if (paymentType === 'cash') {
            // For cash payment, clear cart and go to success page
            clearCart();
            navigate(`/order/${response.data.orderId}`);
          }
        } else {
          console.log('DEBUG: Missing orderId in response');
          setError('Failed to create order. Please try again.');
          setLoading(false);
        }
      } catch (error) {
        console.error('DEBUG: Error creating order:', error);
        
        // Check if it's a payment-related error
        if (error.response?.data?.message?.includes('payment') && paymentType === 'stripe') {
          console.log('DEBUG: Payment-related error detected');
          setError('Payment processing failed. Please try again or choose a different payment method.');
          setPaymentActions(
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="outlined" 
                color="primary"
                onClick={() => {
                  setPaymentType('cash');
                  setError('');
                  setPaymentActions(null);
                  // Update UI to show cash is selected
                  const radioBtn = document.querySelector('input[value="cash"]');
                  if (radioBtn) radioBtn.checked = true;
                }}
              >
                Switch to Cash Payment
              </Button>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => {
                  setPaymentActions(null);
                  handlePlaceOrder();
                }}
              >
                Try Again
              </Button>
            </Box>
          );
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          // Handle timeout specifically
          console.log('DEBUG: Request timeout detected');
          setError('Request timed out. The payment service might be unavailable. Please try again or use cash payment.');
        } else {
          // For other errors
          console.log('DEBUG: Other error type:', error.response?.data?.message || error.message);
          setError(error.response?.data?.message || 'Error creating order');
        }
        
        setLoading(false);
      }
    } catch (error) {
      console.error('DEBUG: Unexpected error in handlePlaceOrder:', error);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const renderShippingForm = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Shipping Address
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            label="Full Name"
            value={shippingAddress.fullName}
            onChange={(e) => setShippingAddress({...shippingAddress, fullName: e.target.value})}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            label="Address Line 1"
            value={shippingAddress.addressLine1}
            onChange={(e) => setShippingAddress({...shippingAddress, addressLine1: e.target.value})}
            placeholder="Street address, P.O. box, company name"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Address Line 2"
            value={shippingAddress.addressLine2}
            onChange={(e) => setShippingAddress({...shippingAddress, addressLine2: e.target.value})}
            placeholder="Apartment, suite, unit, building, floor, etc."
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="City"
            value={shippingAddress.city}
            onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="State/Province/Region"
            value={shippingAddress.state}
            onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="Zip / Postal code"
            value={shippingAddress.postalCode}
            onChange={(e) => setShippingAddress({...shippingAddress, postalCode: e.target.value})}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            required
            fullWidth
            label="Country"
            value={shippingAddress.country}
            onChange={(e) => setShippingAddress({...shippingAddress, country: e.target.value})}
            defaultValue="US"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            required
            fullWidth
            label="Phone Number"
            value={shippingAddress.phoneNumber}
            onChange={(e) => setShippingAddress({...shippingAddress, phoneNumber: e.target.value})}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderPaymentForm = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Payment Method
      </Typography>
      <FormControl component="fieldset">
        <FormLabel component="legend">Select a payment method</FormLabel>
        <RadioGroup
          aria-label="payment-method"
          name="payment-method"
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
        >
          <FormControlLabel
            value="stripe"
            control={<Radio />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" 
                  alt="Stripe"
                  height="20"
                />
                <Typography>Credit Card (Stripe)</Typography>
              </Box>
            }
          />
          <FormControlLabel value="cash" control={<Radio />} label="Cash on Delivery" />
        </RadioGroup>
      </FormControl>
      
      {paymentType === 'stripe' ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          You'll complete your payment securely after confirming your order.
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          You'll pay when your order is delivered.
        </Alert>
      )}
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
        <Typography>{shippingAddress.fullName}</Typography>
        <Typography>{shippingAddress.addressLine1}</Typography>
        {shippingAddress.addressLine2 && <Typography>{shippingAddress.addressLine2}</Typography>}
        <Typography>
          {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
        </Typography>
        <Typography>{shippingAddress.country}</Typography>
        <Typography>Phone: {shippingAddress.phoneNumber}</Typography>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Payment Method
      </Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography>{paymentType === 'cash' ? 'Cash on Delivery' : 'Stripe'}</Typography>
      </Paper>
    </Box>
  );

  // Use useEffect to redirect when orderStatus changes
  useEffect(() => {
    const redirectToProcessingPage = async () => {
      // No need to reference orderStatus anymore
      // Instead, we'll handle this in the handlePlaceOrder function
    };
    
    redirectToProcessingPage();
  }, [navigate]);
  
  // Add a new render function for the processing step
  const renderProcessingStep = () => {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="h6" gutterBottom>
          Processing Order
        </Typography>
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
      </Box>
    );
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderShippingForm();
      case 1:
        return renderPaymentForm();
      case 2:
        return renderOrderSummary();
      case 3: // Processing step
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

      {error && activeStep < steps.length && (
        <Paper 
          elevation={0} 
          sx={{ 
            mb: 3, 
            p: 2, 
            borderRadius: 2, 
            backgroundColor: '#FFF5F5',
            border: '1px solid #FFC7C7'
          }}
        >
          <Typography variant="body1" color="error.main">
            {error}
          </Typography>
          {paymentActions && (
            <Box sx={{ mt: 2 }}>
              {paymentActions}
            </Box>
          )}
        </Paper>
      )}

      {getStepContent(activeStep)}

      {/* Only show nav buttons if not in processing step */}
      {activeStep < steps.length && (
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
      )}

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

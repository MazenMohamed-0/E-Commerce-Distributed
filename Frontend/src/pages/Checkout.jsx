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
  const [orderPolling, setOrderPolling] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [pollingCount, setPollingCount] = useState(0);

  // Add a new const for the processing step
  const PROCESSING_STEP = steps.length;

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
    if (!orderId || !token) {
      console.error('Cannot poll order status: missing orderId or token');
      return;
    }
    
    try {
      console.log(`Polling order status for orderId: ${orderId}`);
      
      const response = await axios.get(
        `http://localhost:3004/orders/${orderId}/status`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      console.log('Order status response:', response.data);
      setOrderStatus(response.data);
      
      // Handle different status cases
      switch(response.data.status) {
        case 'payment_pending':
          // For Stripe payment method, check if we have client secret
          if (paymentType === 'stripe') {
            // Get the client secret from the response - check all possible locations
            const clientSecret = response.data.stripeClientSecret || 
                               response.data.payment?.stripeClientSecret || 
                               response.data.payment?.clientSecret ||
                               (response.data.order && response.data.order.payment?.stripeClientSecret);
            
            console.log('Checking for Stripe client secret:', {
              hasTopLevelSecret: !!response.data.stripeClientSecret,
              hasPaymentSecret: !!response.data.payment?.stripeClientSecret,
              hasAltPaymentSecret: !!response.data.payment?.clientSecret,
              hasOrderSecret: !!(response.data.order && response.data.order.payment?.stripeClientSecret),
              foundSecret: !!clientSecret
            });
            
            if (clientSecret) {
              // Store order info for later reference
              localStorage.setItem('pendingOrderId', orderId);
              // Clear the idempotency key since we're proceeding with this order
              localStorage.removeItem('checkoutIdempotencyKey');
              
              console.log('Got Stripe client secret, redirecting to payment page');
              
              // Add a small delay to ensure everything is saved
              setTimeout(() => {
                // Navigate to Stripe payment page
                navigate(`/payment/stripe?orderId=${orderId}`);
              }, 500);
              
              clearInterval(orderPolling);
              return;
            } else {
              console.error('No Stripe client secret found in response', response.data);
              setError('Payment information not found. Please try again or contact support.');
              clearInterval(orderPolling);
              return;
            }
          }
          // For cash payment, we can proceed as normal
          break;
          
        case 'payment_completed':
        case 'completed':
          // Success! Clear cart and redirect
          setSuccess('Order completed successfully!');
          clearCart();
          // Clear checkout data
          localStorage.removeItem('checkoutIdempotencyKey');
          localStorage.removeItem('pendingOrderId');
          clearInterval(orderPolling);
          navigate('/order/' + orderId);
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
            navigate('/my-orders');
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

      // Check if we have cart items
      if (!cartItems || cartItems.length === 0) {
        throw new Error('Your cart is empty');
      }

      // Generate idempotency key for this checkout session
      const idempotencyKey = generateIdempotencyKey();

      // Calculate total amount
      const totalAmount = getTotal();

      // Log cart items to check their structure
      console.log('Cart items before preparing order:', cartItems);

      // Prepare order data with proper item details and shipping address
      const orderData = {
        items: cartItems.map(item => {
          // Ensure we have all required fields
          if (!item.productId) {
            console.error('Missing productId in cart item:', item);
            throw new Error('Invalid cart item: missing productId');
          }

          // Make sure we have sellerId - either from the item directly or try to get it from other fields
          const sellerId = item.sellerId || item.createdBy || item.seller?._id;
          
          if (!sellerId) {
            console.error('Missing sellerId in cart item:', item);
            throw new Error('Invalid cart item: missing sellerId');
          }
          
          if (!item.name) {
            console.error('Missing name in cart item:', item);
            throw new Error('Invalid cart item: missing product name');
          }

          return {
            productId: item.productId.toString(),
            sellerId: sellerId.toString(),
            productName: item.name,
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price),
            imageUrl: item.imageUrl || ''
          };
        }),
        shippingAddress: shippingAddress,
        totalAmount: parseFloat(totalAmount),
        paymentMethod: paymentType
      };

      console.log('Submitting order with data:', JSON.stringify(orderData, null, 2));

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
      
      // Extract orderId from the response - handle different response formats
      let orderId = null;
      
      // Try to get orderId directly from the response
      if (response.data && response.data.orderId) {
        orderId = response.data.orderId;
      } 
      // If not available, try to get from the order object if present
      else if (response.data && response.data.order && response.data.order._id) {
        orderId = response.data.order._id;
      }
      
      console.log('Extracted orderId:', orderId);
      
      // Show processing status
      setSuccess('Order created! Processing your order...');
      
      // Set activeStep to the processing step
      setActiveStep(PROCESSING_STEP);
      
      // Use the order ID to start polling
      if (orderId) {
        // Set up polling interval (every 2 seconds)
        const interval = setInterval(() => pollOrderStatus(orderId), 2000);
        setOrderPolling(interval);
      } else {
        throw new Error('No order ID received from server');
      }
    } catch (err) {
      console.error('Error creating order:', err);
      // Check if this is a response with orderId (possibly a duplicate order)
      if (err.response?.data?.orderId) {
        const existingOrderId = err.response.data.orderId;
        console.log('Found existing order ID:', existingOrderId);
        setSuccess('Order already exists! Redirecting to order status...');
        
        // Start polling for existing order
        const interval = setInterval(() => pollOrderStatus(existingOrderId), 2000);
        setOrderPolling(interval);
        
        // Set activeStep to processing step
        setActiveStep(PROCESSING_STEP);
        return;
      }
      // Legacy check for backward compatibility
      else if (err.response?.status === 200 && err.response?.data?.order) {
        const existingOrderId = err.response.data.order._id;
        console.log('Found existing order via legacy path:', existingOrderId);
        setSuccess('Order already exists! Redirecting to order status...');
        navigate(`/order/${existingOrderId}`);
        return;
      }
      
      setError(err.response?.data?.message || err.message || 'Failed to create order. Please try again.');
    } finally {
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
        onClick={() => navigate('/my-orders')}
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
      case 3: // Processing step
      case PROCESSING_STEP: // This ensures we handle both ways of setting the step
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

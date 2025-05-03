import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Container,
  Typography,
  Box,
  Paper,
  Alert,
  Button,
  CircularProgress
} from '@mui/material';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Stripe public key
const stripePromise = loadStripe('pk_test_51RKSD3PMNHEuOAn3NdKG49tCTAVd2ULBxZyyqnw2A2FZYpa6s7XJmemez7i9581omBQoPgKxk0L86d2ToCXLcICe00PN0VHHoE');

// Stripe Payment Form Component
const StripeCheckoutForm = ({ orderId, clientSecret, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.log('Stripe.js has not yet loaded');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    
    console.log('Processing payment for order:', orderId);

    try {
      // Confirm payment with Stripe
      console.log('Confirming payment with client secret');
      
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/orders', // Redirect to orders page after payment
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('Stripe payment error:', error);
        setErrorMessage(error.message);
        onError(error.message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment successful
        console.log('Payment intent succeeded:', paymentIntent.id);
        try {
          // Notify backend about successful payment
          const confirmResponse = await axios.post(
            'http://localhost:3005/payments/stripe/confirm', 
            { paymentIntentId: paymentIntent.id },
            { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
          );
          console.log('Payment confirmation response:', confirmResponse.data);
          onSuccess(paymentIntent);
        } catch (apiError) {
          console.error('Error confirming payment with server:', apiError);
          setErrorMessage('Payment succeeded but failed to confirm with server.');
          onError(apiError.message);
        }
      } else {
        // Payment requires additional action
        console.log('Payment intent status:', paymentIntent?.status);
        if (paymentIntent && paymentIntent.status === 'requires_action') {
          setErrorMessage('This payment requires additional verification steps.');
        } else {
          setErrorMessage(`Payment status: ${paymentIntent?.status || 'unknown'}`);
        }
      }
    } catch (err) {
      console.error('Unexpected payment error:', err);
      setErrorMessage('An unexpected error occurred.');
      onError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      
      {errorMessage && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errorMessage}
        </Alert>
      )}
      
      <Button 
        type="submit" 
        variant="contained" 
        color="primary"
        disabled={!stripe || isProcessing}
        fullWidth
        sx={{ mt: 3 }}
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </Button>
    </form>
  );
};

// Main StripePayment component
const StripePayment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    const fetchPaymentDetails = async () => {
      try {
        // Get orderId from URL params
        const params = new URLSearchParams(location.search);
        const id = params.get('orderId');
        
        if (!id) {
          setError('No order ID provided');
          setLoading(false);
          return;
        }
        
        if (!token) {
          setError('You must be logged in to complete payment');
          setLoading(false);
          return;
        }
        
        setOrderId(id);
        
        // Fetch order details to get the client secret
        const response = await axios.get(
          `http://localhost:3004/orders/${id}/status`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        console.log('Order status response:', response.data);
        setOrderDetails(response.data);
        
        // Extract the client secret from the response
        const secret = response.data.payment?.stripeClientSecret || 
                      response.data.stripeClientSecret ||
                      (response.data.order && response.data.order.payment?.stripeClientSecret);
        
        if (!secret) {
          setError('No payment information found for this order');
          setLoading(false);
          return;
        }
        
        setClientSecret(secret);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching payment details:', err);
        setError(err.response?.data?.message || 'Failed to load payment information');
        setLoading(false);
      }
    };
    
    fetchPaymentDetails();
  }, [location, token]);

  const handlePaymentSuccess = () => {
    // Navigate to order success page
    navigate(`/orders/${orderId}`);
  };
  
  const handlePaymentError = (message) => {
    setError(message);
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading payment information...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate('/orders')}
        >
          View Your Orders
        </Button>
      </Container>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#1976d2',
        colorBackground: '#ffffff',
        colorText: '#30313d',
        colorDanger: '#df1b41',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        spacingUnit: '4px',
        borderRadius: '4px',
      },
    },
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          Complete Your Payment
        </Typography>
        
        {orderDetails && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>
            <Typography>
              Order ID: {orderId}
            </Typography>
            <Typography variant="h6" sx={{ mt: 2 }}>
              Total: ${orderDetails.totalAmount?.toFixed(2) || orderDetails.order?.totalAmount?.toFixed(2) || '0.00'}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ mt: 4 }}>
          <Elements stripe={stripePromise} options={options}>
            <StripeCheckoutForm 
              orderId={orderId}
              clientSecret={clientSecret}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </Elements>
        </Box>
        
        <Button 
          variant="outlined" 
          fullWidth 
          onClick={() => navigate('/orders')}
          sx={{ mt: 3 }}
        >
          Cancel Payment
        </Button>
      </Paper>
    </Container>
  );
};

export default StripePayment; 
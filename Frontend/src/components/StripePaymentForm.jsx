import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import axios from 'axios';
import config from '../config';
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material';

// Stripe public key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Actual payment form component
const CheckoutForm = ({ orderId, clientSecret, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { clearCart } = useCart();
  const [errorMessage, setErrorMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentVerified, setIsPaymentVerified] = useState(false);

  // Check if payment is already complete on component mount
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!stripe || !clientSecret || isPaymentVerified) return;
      
      try {
        console.log('Checking payment status on component mount...');
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        
        if (paymentIntent && paymentIntent.status === 'succeeded') {
          console.log('Payment already complete, confirming with server');
          setIsPaymentVerified(true);
          handlePaymentSuccess(paymentIntent);
        }
      } catch (error) {
        console.error('Error checking payment status on load:', error);
        setErrorMessage('Error checking payment status. Please try again or contact support.');
      }
    };
    
    checkPaymentStatus();
  }, [stripe, clientSecret, isPaymentVerified]);
  
  // Handle successful payment
  const handlePaymentSuccess = async (paymentIntent) => {
    console.log('Payment intent succeeded:', paymentIntent.id);
    
    // Avoid duplicate processing
    if (isProcessing && isPaymentVerified) {
      console.log('Payment already being processed, skipping duplicate call');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // First, explicitly confirm the payment with the payment service
      console.log('Sending payment confirmation to server:', paymentIntent.id);
      const confirmResponse = await axios.post(
        `${config.PAYMENT_SERVICE_URL}/payments/stripe/confirm`, 
        { 
          paymentIntentId: paymentIntent.id,
          orderId: orderId  // Include the orderId explicitly in case server needs it
        },
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 10000  // 10 second timeout
        }
      );
      console.log('Payment confirmation response:', confirmResponse.data);
      
      // Clear cart after successful payment confirmation
      await clearCart();
      
      // Set a flag to help with recovery if the page gets refreshed
      localStorage.setItem('paymentSuccessful', 'true');
      localStorage.setItem('paymentIntentId', paymentIntent.id);
      
      // Store orderId in localStorage before redirect
      localStorage.setItem('pendingOrderId', orderId);
      
      // Call onSuccess handler and cleanup state
      setIsProcessing(false);
      onSuccess(paymentIntent);
    } catch (apiError) {
      console.error('Error confirming payment with server:', apiError);
      
      // Even if there's an error confirming with our server, the payment might have succeeded with Stripe
      // Use a fallback approach to avoid customer confusion
      if (paymentIntent.status === 'succeeded') {
        setErrorMessage('Payment succeeded with Stripe, but we had trouble confirming with our server. Your payment should still be processed.');
        
        // Still attempt to clear the cart
        try {
          await clearCart();
        } catch (cartError) {
          console.error('Error clearing cart:', cartError);
        }
        
        // Store info to help with recovery
        localStorage.setItem('paymentSuccessful', 'true');
        localStorage.setItem('paymentIntentId', paymentIntent.id);
        localStorage.setItem('pendingOrderId', orderId);
        
        // Still call success handler since the payment did succeed with Stripe
        setTimeout(() => {
          setIsProcessing(false);
          onSuccess(paymentIntent);
        }, 3000);
      } else {
        setErrorMessage('Payment could not be confirmed with our server. Please contact support if your order is not updated.');
        setIsProcessing(false);
        onError(apiError.message);
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.log('Stripe.js has not yet loaded');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    
    console.log('Processing payment for order:', orderId);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + `/processing-order/${orderId}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        // Show error to customer
        console.error('Stripe payment error:', error);
        setErrorMessage(error.message);
        onError(error.message);
        setIsProcessing(false); // Ensure we set processing to false
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment successful without additional authentication - notify backend
        console.log('Payment succeeded without additional authentication');
        setIsPaymentVerified(true);
        await handlePaymentSuccess(paymentIntent);
        // Note: Don't set isProcessing=false here as handlePaymentSuccess will handle transitions
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        // Payment requires additional authentication
        console.log('Payment requires additional authentication, redirecting...');
        setErrorMessage('This payment requires additional verification. You will be redirected to complete authentication.');
        // Store orderId in localStorage before the user is redirected
        localStorage.setItem('pendingOrderId', orderId);
        // No need to set isProcessing=false because redirect will happen
      } else {
        // Other payment status
        console.log('Payment intent status:', paymentIntent?.status);
        setErrorMessage(`Payment status: ${paymentIntent?.status || 'unknown'}`);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Unexpected payment error:', err);
      setErrorMessage('An unexpected error occurred.');
      onError(err.message);
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
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button 
          type="submit" 
          variant="contained" 
          color="primary"
          disabled={!stripe || isProcessing}
          size="large"
          fullWidth
        >
          {isProcessing ? 'Processing...' : 'Pay Now'}
        </Button>
      </Box>
    </form>
  );
};

// Wrapper component that handles loading Stripe and the PaymentIntent
const StripePaymentForm = ({ orderId, clientSecret, onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Validate required props
    if (!orderId) {
      console.error('Missing orderId in StripePaymentForm');
      onError('Missing order information');
      return;
    }
    
    if (!clientSecret) {
      console.error('Missing clientSecret in StripePaymentForm');
      onError('Missing payment information');
      return;
    }
    
    console.log('Initializing Stripe payment form for order:', orderId);
    setIsLoading(false);
  }, [orderId, clientSecret, onError]);

  if (isLoading) {
    return <Box sx={{ textAlign: 'center', py: 4 }}>
      <CircularProgress size={40} />
      <Typography variant="body1" sx={{ mt: 2 }}>
        Loading payment form...
      </Typography>
    </Box>;
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0d6efd',
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
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm 
        orderId={orderId} 
        clientSecret={clientSecret} 
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
};

export default StripePaymentForm; 
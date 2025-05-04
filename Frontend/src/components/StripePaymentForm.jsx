import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import axios from 'axios';
import config from '../config';
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material';

// Stripe public key
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
console.log('DEBUG: Stripe publishable key available:', !!STRIPE_PK);

// Initialize Stripe only if the key exists
const stripePromise = STRIPE_PK 
  ? loadStripe(STRIPE_PK).catch(err => {
      console.error('DEBUG: Error loading Stripe:', err);
      return null;
    })
  : Promise.resolve(null);

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
        console.log('DEBUG: Checking payment status with clientSecret');
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        
        console.log('DEBUG: Payment intent retrieved:', paymentIntent.status);
        
        if (paymentIntent && paymentIntent.status === 'succeeded') {
          console.log('DEBUG: Payment already succeeded, handling success');
          setIsPaymentVerified(true);
          handlePaymentSuccess(paymentIntent);
        }
      } catch (error) {
        console.error('DEBUG: Error checking payment status:', error.message);
        setErrorMessage('Error checking payment status. Please try again or contact support.');
      }
    };
    
    checkPaymentStatus();
  }, [stripe, clientSecret, isPaymentVerified]);
  
  // Handle successful payment
  const handlePaymentSuccess = async (paymentIntent) => {
    // Avoid duplicate processing
    if (isProcessing && isPaymentVerified) {
      console.log('DEBUG: Skipping duplicate payment processing');
      return;
    }
    
    console.log('DEBUG: Starting payment success handling process');
    setIsProcessing(true);
    
    try {
      const token = localStorage.getItem('token');
      
      console.log('DEBUG: Confirming payment with server', {
        paymentIntentId: paymentIntent.id,
        orderId: orderId
      });
      
      // First, explicitly confirm the payment with the payment service
      await axios.post(
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
      
      console.log('DEBUG: Payment confirmed with server successfully');
      
      // Clear cart after successful payment confirmation
      await clearCart();
      console.log('DEBUG: Cart cleared successfully');
      
      // Set a flag to help with recovery if the page gets refreshed
      localStorage.setItem('paymentSuccessful', 'true');
      localStorage.setItem('paymentIntentId', paymentIntent.id);
      
      // Store orderId in localStorage before redirect
      localStorage.setItem('pendingOrderId', orderId);
      
      console.log('DEBUG: Payment success handling complete, calling onSuccess callback');
      
      // Call onSuccess handler and cleanup state
      setIsProcessing(false);
      onSuccess(paymentIntent);
    } catch (apiError) {
      console.error('DEBUG: Error confirming payment with server:', apiError.message);
      
      // Even if there's an error confirming with our server, the payment might have succeeded with Stripe
      // Use a fallback approach to avoid customer confusion
      if (paymentIntent.status === 'succeeded') {
        console.log('DEBUG: Payment succeeded with Stripe despite server confirmation error');
        setErrorMessage('Payment succeeded with Stripe, but we had trouble confirming with our server. Your payment should still be processed.');
        
        // Still attempt to clear the cart
        try {
          await clearCart();
          console.log('DEBUG: Cart cleared in fallback flow');
        } catch (cartError) {
          console.error('DEBUG: Error clearing cart in fallback flow:', cartError.message);
        }
        
        // Store info to help with recovery
        localStorage.setItem('paymentSuccessful', 'true');
        localStorage.setItem('paymentIntentId', paymentIntent.id);
        localStorage.setItem('pendingOrderId', orderId);
        
        console.log('DEBUG: Calling success handler in fallback flow');
        
        // Still call success handler since the payment did succeed with Stripe
        setTimeout(() => {
          setIsProcessing(false);
          onSuccess(paymentIntent);
        }, 3000);
      } else {
        console.log('DEBUG: Payment confirmation failed with server and payment not succeeded with Stripe');
        setErrorMessage('Payment could not be confirmed with our server. Please contact support if your order is not updated.');
        setIsProcessing(false);
        onError(apiError.message);
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.log('DEBUG: Stripe or elements not available yet');
      return;
    }

    console.log('DEBUG: Starting payment confirmation process');
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      console.log('DEBUG: Calling stripe.confirmPayment');
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + `/processing-order/${orderId}`,
        },
        redirect: 'if_required',
      });

      console.log('DEBUG: stripe.confirmPayment completed', { 
        error: error ? 'Error present' : 'No error',
        paymentIntentStatus: paymentIntent?.status || 'No paymentIntent'
      });

      if (error) {
        // Show error to customer
        console.error('DEBUG: Payment error:', error.message, error.type);
        setErrorMessage(error.message);
        onError(error.message);
        setIsProcessing(false); // Ensure we set processing to false
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('DEBUG: Payment succeeded immediately without additional authentication');
        // Payment successful without additional authentication - notify backend
        setIsPaymentVerified(true);
        await handlePaymentSuccess(paymentIntent);
        // Note: Don't set isProcessing=false here as handlePaymentSuccess will handle transitions
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        console.log('DEBUG: Payment requires additional authentication actions');
        // Payment requires additional authentication
        setErrorMessage('This payment requires additional verification. You will be redirected to complete authentication.');
        // Store orderId in localStorage before the user is redirected
        localStorage.setItem('pendingOrderId', orderId);
        // No need to set isProcessing=false because redirect will happen
      } else {
        console.log('DEBUG: Other payment status:', paymentIntent?.status || 'unknown');
        // Other payment status
        setErrorMessage(`Payment status: ${paymentIntent?.status || 'unknown'}`);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('DEBUG: Unexpected payment error:', err.message);
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
  const [stripeError, setStripeError] = useState(null);
  
  // Add a useEffect to verify the Stripe key is available
  useEffect(() => {
    if (!STRIPE_PK) {
      console.error('DEBUG: Stripe publishable key is missing in environment variables');
      setStripeError('Stripe configuration is missing. Please contact support.');
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    // Validate required props
    if (!orderId) {
      console.error('Missing orderId in StripePaymentForm');
      onError('Missing order information');
      return;
    }
    
    if (!clientSecret) {
      console.error('Missing clientSecret');
      onError('Missing payment information');
      return;
    }
    
    console.log('DEBUG: StripePaymentForm initialized with valid props', { 
      hasOrderId: !!orderId,
      hasClientSecret: !!clientSecret
    });
    
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
  
  if (stripeError) {
    return <Box sx={{ textAlign: 'center', py: 4 }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        {stripeError}
      </Alert>
      <Button
        variant="contained"
        color="primary"
        onClick={() => window.location.reload()}
      >
        Try Again
      </Button>
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
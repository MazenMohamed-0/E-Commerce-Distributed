import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Stripe public key - you should get this from your backend in production
const stripePromise = loadStripe('pk_test_51RKSD3PMNHEuOAn3NdKG49tCTAVd2ULBxZyyqnw2A2FZYpa6s7XJmemez7i9581omBQoPgKxk0L86d2ToCXLcICe00PN0VHHoE');

// Actual payment form component
const CheckoutForm = ({ orderId, clientSecret, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      console.log('Stripe.js has not yet loaded');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    
    console.log('Processing payment for order:', orderId);

    try {
      // Confirm payment with Stripe
      console.log('Confirming payment with client secret (first few chars):', clientSecret.substring(0, 10) + '...');
      
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/payment/success?order_id=' + orderId,
        },
        redirect: 'if_required',
      });

      if (error) {
        // Show error to customer
        console.error('Stripe payment error:', error);
        setErrorMessage(error.message);
        onError(error.message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment successful - notify backend
        console.log('Payment intent succeeded:', paymentIntent.id);
        try {
          const confirmResponse = await axios.post('/api/payments/stripe/confirm', {
            paymentIntentId: paymentIntent.id
          });
          console.log('Payment confirmation response:', confirmResponse.data);
          onSuccess(paymentIntent);
        } catch (apiError) {
          console.error('Error confirming payment with server:', apiError);
          setErrorMessage('Payment succeeded but failed to confirm with server.');
          onError(apiError.message);
        }
      } else {
        // Payment requires additional action from user or is processing
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
    <form onSubmit={handleSubmit} className="payment-form">
      <PaymentElement />
      
      {errorMessage && (
        <div className="error-message mt-3">
          <p className="text-danger">{errorMessage}</p>
        </div>
      )}
      
      <button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="btn btn-primary mt-4 w-100"
      >
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
};

// Wrapper component that handles loading Stripe and the PaymentIntent
const StripePaymentForm = ({ orderId, paymentIntentId, clientSecret, onSuccess, onError }) => {
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
    return <div className="text-center my-4">Loading payment form...</div>;
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
    <div className="stripe-payment-container">
      <h3 className="mb-4">Complete Your Payment</h3>
      <Elements stripe={stripePromise} options={options}>
        <CheckoutForm 
          orderId={orderId} 
          clientSecret={clientSecret}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    </div>
  );
};

export default StripePaymentForm; 
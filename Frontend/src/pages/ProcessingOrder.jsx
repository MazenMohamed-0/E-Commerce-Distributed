import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress,
  Button
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import axios from 'axios';
import config from '../config';
import StripePaymentForm from '../components/StripePaymentForm';

const ProcessingOrder = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const { clearCart } = useCart();
  const navigate = useNavigate();
  
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Debug log to check if environment variables are available
  console.log('DEBUG: Environment check:', {
    hasStripeKey: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    paymentServiceURL: config.PAYMENT_SERVICE_URL
  });
  
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        console.log('DEBUG: Fetching order details for ID:', id);
        const response = await axios.get(
          `${config.ORDER_SERVICE_URL}/orders/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        console.log('DEBUG: Order details received:', {
          orderId: response.data._id || response.data.orderId,
          paymentMethod: response.data.paymentMethod,
          hasPayment: !!response.data.payment,
          hasClientSecret: response.data.payment?.hasClientSecret || false
        });
        
        setOrderData(response.data);
        
        // Handle different payment methods directly
        if (response.data.paymentMethod === 'cash') {
          console.log('DEBUG: Cash payment detected, navigating to order success');
          // For cash payment, navigate to success page
          navigate(`/order/${response.data.orderId || id}`, { replace: true });
          return;
        } else if (response.data.paymentMethod === 'stripe') {
          console.log('DEBUG: Stripe payment detected, checking for client secret');
          // Need to fetch the payment details separately to avoid exposing sensitive data in logs
          if (response.data.payment?.hasClientSecret || response.data._id) {
            try {
              console.log('DEBUG: Fetching payment details for order');
              // Make a special call to get the payment details for this order
              const paymentResponse = await axios.get(
                `${config.PAYMENT_SERVICE_URL}/payments/order/${response.data._id || id}/details`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                }
              );
              
              console.log('DEBUG: Payment details received:', {
                hasClientSecret: !!paymentResponse.data.stripeClientSecret,
                hasPaymentIntentId: !!paymentResponse.data.stripePaymentIntentId
              });
              
              // Update order data with payment info
              if (paymentResponse.data && paymentResponse.data.stripeClientSecret) {
                console.log('DEBUG: Client secret found, updating order data');
                setOrderData(prev => ({
                  ...prev,
                  payment: {
                    ...prev.payment,
                    stripeClientSecret: paymentResponse.data.stripeClientSecret,
                    stripePaymentIntentId: paymentResponse.data.stripePaymentIntentId
                  }
                }));
                setLoading(false);
              } else {
                console.log('DEBUG: No client secret found in payment details');
                setError("Payment information not available");
                setLoading(false);
              }
            } catch (paymentError) {
              console.error('DEBUG: Error fetching payment details:', paymentError);
              setError("Error loading payment information");
              setLoading(false);
            }
          } else {
            console.log('DEBUG: No client secret info available in order data');
            // If no client secret info available, show error
            setError("Payment information not available");
            setLoading(false);
          }
        } else {
          console.log('DEBUG: Unsupported payment method:', response.data.paymentMethod);
          // For other payment methods, show error
          setError("Unsupported payment method");
          setLoading(false);
        }
      } catch (error) {
        console.error('DEBUG: Error fetching order details:', error);
        setError("Error loading order details");
        setLoading(false);
      }
    };
    
    fetchOrderDetails();
  }, [id, token, navigate]);
  
  const handlePaymentSuccess = async () => {
    console.log('DEBUG: Payment success callback triggered');
    // Clear cart before navigating to order details
    await clearCart();
    console.log('DEBUG: Cart cleared, navigating to order details');
    navigate(`/order/${id}`, { replace: true });
  };
  
  const handlePaymentError = (errorMessage) => {
    console.log('DEBUG: Payment error callback triggered:', errorMessage);
    setError(errorMessage);
  };
  
  return (
    <>
      <Navbar />
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Processing Your Order
        </Typography>
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Box sx={{ mt: 2 }}>
            <Typography color="error" variant="body1">{error}</Typography>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={() => navigate('/cart')}
              >
                Return to Cart
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate('/checkout')}
              >
                Try Different Payment Method
              </Button>
            </Box>
          </Box>
        )}
        
        {!loading && !error && orderData?.payment?.stripeClientSecret && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Please complete your payment
            </Typography>
            <StripePaymentForm 
              orderId={id}
              clientSecret={orderData.payment.stripeClientSecret}
              paymentIntentId={orderData.payment.stripePaymentIntentId}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </Box>
        )}
      </Container>
    </>
  );
};

export default ProcessingOrder; 
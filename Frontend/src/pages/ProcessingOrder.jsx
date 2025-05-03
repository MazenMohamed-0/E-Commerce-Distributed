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
  
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await axios.get(
          `${config.ORDER_SERVICE_URL}/orders/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        setOrderData(response.data);
        
        // Handle different payment methods directly
        if (response.data.paymentMethod === 'cash') {
          // For cash payment, navigate to success page
          navigate(`/order/${response.data.orderId || id}`, { replace: true });
          return;
        } else if (response.data.paymentMethod === 'stripe') {
          // For stripe, check if client secret exists
          if (response.data.payment?.stripeClientSecret) {
            setLoading(false);
          } else {
            // If no payment info yet, handle error
            setError("Payment information not available");
            setLoading(false);
          }
        } else {
          // For other payment methods, show error
          setError("Unsupported payment method");
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        setError("Error loading order details");
        setLoading(false);
      }
    };
    
    fetchOrderDetails();
  }, [id, token, navigate]);
  
  const handlePaymentSuccess = async () => {
    // Clear cart before navigating to order details
    await clearCart();
    navigate(`/order/${id}`, { replace: true });
  };
  
  const handlePaymentError = (errorMessage) => {
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
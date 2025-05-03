import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CardMedia
} from '@mui/material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import config from '../config';
import Navbar from '../components/Navbar';
import OrderStatusTracker from '../components/OrderStatusTracker';
import { ArrowBack } from '@mui/icons-material';
import { useBackNavigation } from '../hooks/useBackNavigation';

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Use custom hook for back navigation with my-orders as the default fallback
  const handleBack = useBackNavigation('/my-orders');

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError('');

      console.log(`Fetching order details for order ID: ${id}`);
      
      const response = await axios.get(
        `${config.ORDER_SERVICE_URL}/orders/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data) {
        console.log('Order data received:', response.data);
        setOrder(response.data);
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError(err.response?.data?.message || 'Failed to load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'warning';
      case 'processing':
        return 'info';
      case 'payment_pending':
        return 'warning';
      case 'payment_completed':
        return 'info';
      case 'completed':
        return 'success';
      case 'shipped':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Add a function to display info about special order states
  const getSpecialOrderMessage = (order) => {
    if (order.status === 'failed' && order.payment?.status === 'completed') {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2">
            Payment received but order could not be fulfilled
          </Typography>
          <Typography variant="body2">
            Your payment was successful, but the order could not be completed due to issues such as
            product availability. Please contact customer service for assistance with a refund.
          </Typography>
        </Alert>
      );
    }
    return null;
  };

  // Format the status display
  const getFormattedStatus = (order) => {
    // Special case - payment completed but order failed
    if (order.status === 'failed' && order.payment?.status === 'completed') {
      return (
        <Box>
          <Chip
            label="Payment Received"
            color="warning"
            sx={{ mr: 1 }}
          />
          <Chip
            label="Order Failed"
            color="error"
          />
        </Box>
      );
    }
    
    // Normal case
    return (
      <Chip
        label={order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        color={getStatusColor(order.status)}
      />
    );
  };

  // Format payment details display
  const getPaymentDetails = (payment, paymentMethod) => {
    if (!payment) return null;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Payment Information:
        </Typography>
        <Typography variant="body2">
          Method: {paymentMethod || 'Cash on Delivery'}
        </Typography>
        {payment.paymentId && (
          <Typography variant="body2" color="text.secondary">
            Payment ID: {payment.paymentId}
          </Typography>
        )}
        {payment.updatedAt && (
          <Typography variant="body2" color="text.secondary">
            Last Updated: {new Date(payment.updatedAt).toLocaleString()}
          </Typography>
        )}
        
        {/* Payment actions */}
        {payment.paymentUrl && payment.status !== 'completed' && (
          <Button 
            variant="contained" 
            color="primary"
            href={payment.paymentUrl}
            target="_blank"
            sx={{ mt: 1 }}
            size="small"
          >
            Complete Payment
          </Button>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          color="primary"
          onClick={handleBack}
        >
          Back to Orders
        </Button>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Order not found
        </Alert>
        <Button
          variant="contained"
          color="primary"
          onClick={handleBack}
        >
          Back to Orders
        </Button>
      </Container>
    );
  }

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button 
            startIcon={<ArrowBack />} 
            onClick={handleBack}
            variant="outlined"
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h4">
            Order Details
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Order Status Tracker */}
          <Grid item xs={12}>
            <OrderStatusTracker order={order} />
          </Grid>

          {/* Order Status and Payment Info */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Order Status
              </Typography>
              <Box sx={{ mb: 2 }}>
                {getFormattedStatus(order)}
                
                {/* Show status history if available */}
                {order.statusHistory && order.statusHistory.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Status Timeline:
                    </Typography>
                    {order.statusHistory.map((status, index) => (
                      <Box key={index} sx={{ display: 'flex', mb: 1, alignItems: 'center' }}>
                        <Box 
                          sx={{ 
                            width: 10, 
                            height: 10, 
                            borderRadius: '50%', 
                            bgcolor: getStatusColor(status.status), 
                            mr: 1 
                          }} 
                        />
                        <Typography variant="body2" sx={{ mr: 1 }}>
                          {new Date(status.timestamp).toLocaleString()}: 
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {status.status}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Order ID: {order._id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Date: {new Date(order.createdAt).toLocaleString()}
              </Typography>
              {getPaymentDetails(order.payment, order.paymentMethod)}
            </Paper>
          </Grid>

          {/* Shipping Address */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Shipping Address
              </Typography>
              {order.shippingAddress && typeof order.shippingAddress === 'object' ? (
                <Box>
                  <Typography variant="body1">{order.shippingAddress.fullName}</Typography>
                  <Typography variant="body1">{order.shippingAddress.addressLine1}</Typography>
                  {order.shippingAddress.addressLine2 && (
                    <Typography variant="body1">{order.shippingAddress.addressLine2}</Typography>
                  )}
                  <Typography variant="body1">
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                  </Typography>
                  <Typography variant="body1">{order.shippingAddress.country}</Typography>
                  <Typography variant="body1">Phone: {order.shippingAddress.phoneNumber}</Typography>
                </Box>
              ) : (
                <Typography variant="body1">
                  {typeof order.shippingAddress === 'string' ? order.shippingAddress : 'No shipping address available'}
                </Typography>
              )}
            </Paper>
          </Grid>

          {/* Order Items */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Order Items
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {order.items.map((item) => (
                      <TableRow key={item._id || item.productId}>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle1">
                              {item.productName || item.productDetails?.name || 'Product Name Not Available'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Product ID: {item.productId}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {(item.imageUrl || item.productDetails?.imageUrl) ? (
                            <CardMedia
                              component="img"
                              sx={{ width: 80, height: 80, objectFit: 'contain' }}
                              image={item.imageUrl || item.productDetails?.imageUrl}
                              alt={item.productName || item.productDetails?.name || 'Product image'}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 80,
                                height: 80,
                                bgcolor: 'grey.200',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Typography variant="body2" color="text.secondary">
                                No Image
                              </Typography>
                            </Box>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          ${item.price ? parseFloat(item.price).toFixed(2) : (item.productDetails?.price?.toFixed(2) || '0.00')}
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">
                          ${(parseFloat(item.price || item.productDetails?.price || 0) * item.quantity).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} align="right">
                        <Typography variant="h6">Total Amount:</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="h6">
                          ${order.totalAmount.toFixed(2)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </>
  );
};

export default OrderDetails; 
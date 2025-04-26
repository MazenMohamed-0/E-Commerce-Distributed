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
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import config from '../config';
import Navbar from '../components/Navbar';

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get(
        `${config.ORDER_SERVICE_URL}/orders/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data) {
        console.log('Order data:', response.data.items);
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
    switch (status) {
      case 'processing':
        return 'warning';
      case 'shipped':
        return 'info';
      case 'delivered':
        return 'success';
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
          onClick={() => navigate('/my-orders')}
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
          onClick={() => navigate('/my-orders')}
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
        <Box sx={{ mb: 4 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/my-orders')}
            sx={{ mb: 2 }}
          >
            Back to Orders
          </Button>
          <Typography variant="h4" gutterBottom>
            Order Details
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Order Status and Payment Info */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Order Status
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Chip
                  label={order.status}
                  color={getStatusColor(order.status)}
                  sx={{ mr: 1 }}
                />
               
              </Box>
              <Typography variant="body2" color="text.secondary">
                Order ID: {order._id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Date: {new Date(order.createdAt).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Payment Type: {order.paymentType}
              </Typography>
            </Paper>
          </Grid>

          {/* Shipping Address */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Shipping Address
              </Typography>
              <Typography variant="body1">
                {order.shippingAddress}
              </Typography>
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
                      <TableRow key={item._id}>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle1">
                              {item.productDetails?.name || 'Product Name Not Available'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.productDetails?.description || 'No description available'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {item.productDetails?.imageUrl ? (
                            <CardMedia
                              component="img"
                              sx={{ width: 80, height: 80, objectFit: 'contain' }}
                              image={item.productDetails.imageUrl}
                              alt={item.productDetails.name}
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
                          ${item.productDetails?.price?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">
                          ${((item.productDetails?.price || 0) * item.quantity).toFixed(2)}
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
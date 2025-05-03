import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Pagination
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import config from '../config';
import Navbar from '../components/Navbar';
import { ArrowBack } from '@mui/icons-material';
import { useBackNavigation } from '../hooks/useBackNavigation';

const MyOrders = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ordersPerPage = 10;

  // Use the custom hook for back navigation
  const handleBack = useBackNavigation('/');

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user || !token) {
      navigate('/login', { state: { from: '/account/orders' } });
      return;
    }

    fetchOrders();
  }, [user, token, navigate, page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      let endpoint = '/orders/my-orders';
      if (user.role === 'admin') {
        endpoint = '/orders';
      } else if (user.role === 'seller') {
        endpoint = '/orders/seller-orders';
      }

      const response = await axios.get(
        `${config.ORDER_SERVICE_URL}${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data) {
        setOrders(response.data);
        setTotalPages(Math.ceil(response.data.length / ordersPerPage));
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
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
      case 'delivered':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  // const getPaymentStatusColor = (status) => {
  //   switch (status) {
  //     case 'completed':
  //       return 'success';
  //     case 'pending':
  //       return 'warning';
  //     case 'failed':
  //       return 'error';
  //     default:
  //       return 'default';
  //   }
  // };

  // const formatDate = (dateString) => {
  //   const date = new Date(dateString);
  //   return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  // };

  // Calculate pagination
  const paginatedOrders = orders.slice(
    (page - 1) * ordersPerPage,
    page * ordersPerPage
  );

  // Format the order status for display
  const getOrderStatusDisplay = (order) => {
    // Special case - payment completed but order failed
    if (order.status === 'failed' && order.payment?.status === 'completed') {
      return (
        <Box>
          <Chip
            label="Payment Received"
            color="warning"
            size="small"
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" display="block" color="text.secondary">
            Payment received but order could not be fulfilled
          </Typography>
        </Box>
      );
    }
    
    // Normal cases
    return (
      <Chip
        label={order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        color={getStatusColor(order.status)}
        size="small"
      />
    );
  };

  // Get combined status info for display
  const getPaymentInfo = (order) => {
    // If we have a pending payment and payment method is Stripe
    if (order.payment?.status === 'pending' && order.paymentMethod === 'stripe') {
      return (
        <Box>
          {order.payment?.paymentUrl ? (
            <Button
              variant="contained"
              color="primary"
              size="small"
              href={order.payment.paymentUrl}
              target="_blank"
              sx={{ ml: 1 }}
            >
              Pay Now
            </Button>
          ) : (
            <Chip
              label="Payment Pending"
              color="warning"
              size="small"
            />
          )}
        </Box>
      );
    }
    
    // Return the payment method info
    return order.paymentMethod || 'Cash';
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      </>
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
            My Orders
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {orders.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              You haven't placed any orders yet.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              sx={{ mt: 2 }}
              onClick={() => navigate('/')}
            >
              Start Shopping
            </Button>
          </Paper>
        ) : (
          <>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Order ID</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Total Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payment Method</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order._id}>
                      <TableCell>{order._id.substring(0, 8)}...</TableCell>
                      <TableCell>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>${order.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        {getOrderStatusDisplay(order)}
                      </TableCell>
                      <TableCell>
                        {getPaymentInfo(order)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {totalPages > 1 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </Container>
    </>
  );
};

export default MyOrders;

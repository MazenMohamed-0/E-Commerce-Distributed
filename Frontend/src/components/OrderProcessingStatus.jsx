import React from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

/**
 * A component that displays the current order processing status with user-friendly styling
 */
const OrderProcessingStatus = ({ status, message, error }) => {
  // If we have an error, prioritize showing that
  if (error) {
    // Check if it's a validation error
    const isValidationError = error.includes('validation failed') || 
                             error.includes('required') ||
                             error.includes('items.productId');
    
    // More specific handling for product ID validation errors
    const isProductIdError = error.includes('items.productId');
    
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          backgroundColor: '#FFF5F5',
          border: '1px solid #FFC7C7',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <ErrorOutlineIcon color="error" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="h6" color="error.main" gutterBottom>
          {isProductIdError ? 'Product Information Missing' : 
           isValidationError ? 'Order Information Incomplete' : 
           'We couldn\'t complete your order'}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '80%', mb: 2 }}>
          {isProductIdError 
            ? 'One or more products in your cart are missing required information.'
            : isValidationError 
              ? 'There appears to be missing information in your order. This could be due to a temporary issue with our system.'
              : error}
        </Typography>
        <Typography variant="body2" sx={{ maxWidth: '80%' }}>
          {isValidationError 
            ? 'Please try returning to your cart and checking out again. If the problem persists, please contact customer support.'
            : 'Don\'t worry, no payment has been taken. Please try again later or contact customer support if this problem persists.'}
        </Typography>
      </Paper>
    );
  }

  // If no status yet, show loading
  if (!status) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
        <CircularProgress size={50} sx={{ mb: 3 }} />
        <Typography variant="h6" gutterBottom>
          Processing Your Order
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please wait while we validate your order details. This won't take long.
        </Typography>
      </Box>
    );
  }

  // For failed status
  if (status === 'failed') {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          backgroundColor: '#FFF5F5',
          border: '1px solid #FFC7C7',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <ErrorOutlineIcon color="error" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="h6" color="error.main" gutterBottom>
          Order Processing Failed
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '80%', mb: 2 }}>
          {message || "We couldn't process your order at this time."}
        </Typography>
        <Typography variant="body2" sx={{ maxWidth: '80%', mb: 2 }}>
          Don't worry, no payment has been taken. Please try again later or contact customer support if this problem persists.
        </Typography>
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          borderRadius: 1, 
          backgroundColor: 'rgba(0,0,0,0.03)', 
          width: '80%',
          maxWidth: '400px'
        }}>
          <Typography variant="body2" color="text.secondary">
            You'll be automatically redirected to your orders page
          </Typography>
        </Box>
      </Paper>
    );
  }

  // For pending/processing status
  if (status === 'pending' || status === 'processing') {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          backgroundColor: '#F0F7FF',
          border: '1px solid #BFDEFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <InfoIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="h6" color="primary.main" gutterBottom>
          Processing Your Order
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '80%' }}>
          {message || "We're validating your order details. This will only take a moment."}
        </Typography>
      </Paper>
    );
  }

  // For completed status
  if (status === 'completed') {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          backgroundColor: '#F0FFF4',
          border: '1px solid #C6F6D5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="h6" color="success.main" gutterBottom>
          Order Completed Successfully
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '80%' }}>
          {message || "Your order has been confirmed and is being prepared."}
        </Typography>
      </Paper>
    );
  }

  // Default case for other statuses
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        mb: 3,
        borderRadius: 2,
        backgroundColor: '#F5F5F5',
        border: '1px solid #E0E0E0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}
    >
      <InfoIcon sx={{ fontSize: 48, mb: 2, color: '#757575' }} />
      <Typography variant="h6" gutterBottom>
        Order Status: {status.charAt(0).toUpperCase() + status.slice(1)}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '80%' }}>
        {message || "We're working on your order."}
      </Typography>
    </Paper>
  );
};

export default OrderProcessingStatus; 
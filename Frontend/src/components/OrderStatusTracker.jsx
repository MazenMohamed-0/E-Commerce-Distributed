import React from 'react';
import { 
  Box, 
  Stepper, 
  Step, 
  StepLabel, 
  Typography, 
  Paper,
  Divider
} from '@mui/material';
import { 
  CheckCircle, 
  Error, 
  PendingOutlined, 
  ShoppingCart, 
  Inventory, 
  Payment, 
  LocalShipping 
} from '@mui/icons-material';

// Map status to step number
const getStepFromStatus = (status) => {
  const statusMap = {
    'pending': 0,
    'stock_validating': 1,
    'stock_validated': 1,
    'payment_pending': 2,
    'payment_completed': 3,
    'completed': 4,
    'shipped': 5,
    'delivered': 6,
    'failed': -1,
    'cancelled': -1
  };
  
  return statusMap[status.toLowerCase()] !== undefined ? 
    statusMap[status.toLowerCase()] : 0;
};

// Custom step icon based on status
const StepIcon = ({ status, active, completed, error }) => {
  if (error) {
    return <Error color="error" />;
  }
  
  if (completed) {
    return <CheckCircle color="success" />;
  }
  
  if (active) {
    return <PendingOutlined color="primary" />;
  }
  
  // Default icons for each step
  const icons = {
    0: <ShoppingCart />,
    1: <Inventory />,
    2: <Payment />,
    3: <Payment />,
    4: <CheckCircle />,
    5: <LocalShipping />
  };
  
  return icons[status] || <PendingOutlined />;
};

const OrderStatusTracker = ({ order }) => {
  if (!order) return null;
  
  const steps = [
    'Order Placed',
    'Stock Validation',
    'Payment Processing',
    'Payment Completed',
    'Order Completed',
    'Shipped'
  ];
  
  const currentStep = getStepFromStatus(order.status);
  const isFailed = order.status.toLowerCase() === 'failed' || 
                  order.status.toLowerCase() === 'cancelled';
  
  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Order Progress
      </Typography>
      
      <Stepper activeStep={currentStep} alternativeLabel>
        {steps.map((label, index) => (
          <Step 
            key={label}
            completed={index < currentStep && !isFailed}
          >
            <StepLabel 
              error={isFailed && index === currentStep}
              StepIconComponent={(props) => (
                <StepIcon 
                  {...props} 
                  status={index} 
                  error={isFailed && index === currentStep} 
                />
              )}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
        <Typography variant="body1" fontWeight="bold" sx={{ mr: 1 }}>
          Current Status:
        </Typography>
        <Typography 
          variant="body1" 
          color={isFailed ? 'error.main' : 'primary.main'}
        >
          {order.status}
        </Typography>
      </Box>
      
      {order.error && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="error">
            Error: {order.error.message}
          </Typography>
          {order.error.step && (
            <Typography variant="body2" color="text.secondary">
              Failed during: {order.error.step}
            </Typography>
          )}
        </Box>
      )}
      
      {order.payment && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2">
            Payment Status: {order.payment.status}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default OrderStatusTracker; 
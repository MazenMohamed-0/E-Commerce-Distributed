import React from 'react';
import { 
  Box, 
  Stepper, 
  Step, 
  StepLabel, 
  Typography, 
  Paper,
  useTheme
} from '@mui/material';
import { 
  ShoppingCartOutlined,
  PaymentOutlined,
  LocalShippingOutlined,
  CheckCircleOutline
} from '@mui/icons-material';

const OrderStatusTracker = ({ order }) => {
  const theme = useTheme();
  
  // Define steps based on our simplified status model
  const steps = [
    { 
      label: 'Order Placed', 
      icon: <ShoppingCartOutlined />,
      status: 'pending'
    },
    { 
      label: 'Processing', 
      icon: <PaymentOutlined />,
      status: 'processing'
    },
    { 
      label: 'Completed', 
      icon: <CheckCircleOutline />,
      status: 'completed'
    }
  ];
  
  // Determine current active step based on order status
  let activeStep = 0;
  if (!order) {
    activeStep = 0;
  } else if (order.status === 'processing') {
    activeStep = 1;
  } else if (order.status === 'completed') {
    activeStep = 2;
  } else if (order.status === 'failed' || order.status === 'cancelled') {
    activeStep = -1; // Special case for failed orders
  }
  
  return (
    <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Order Progress
      </Typography>
      
      {/* For failed or cancelled orders, show special message */}
      {(order?.status === 'failed' || order?.status === 'cancelled') ? (
        <Box 
          sx={{ 
            p: 2, 
            backgroundColor: theme.palette.error.light, 
            color: theme.palette.error.dark,
            borderRadius: 1,
            my: 2 
          }}
        >
          <Typography variant="subtitle1">
            {order.status === 'failed' ? 'Order Failed' : 'Order Cancelled'}
          </Typography>
          <Typography variant="body2">
            {order.error?.message || (order.status === 'failed' 
              ? 'There was an issue with your order. Please contact customer support.'
              : 'This order has been cancelled.')}
          </Typography>
        </Box>
      ) : (
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 2 }}>
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel 
                StepIconComponent={() => (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: activeStep >= index 
                        ? theme.palette.primary.main 
                        : theme.palette.grey[300],
                      color: activeStep >= index 
                        ? theme.palette.primary.contrastText 
                        : theme.palette.text.secondary
                    }}
                  >
                    {step.icon}
                  </Box>
                )}
              >
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      )}
      
      {/* Show current status */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Status: {' '}
          <Box 
            component="span" 
            sx={{ 
              fontWeight: 'bold',
              color: order?.status === 'failed' || order?.status === 'cancelled'
                ? theme.palette.error.main
                : order?.status === 'completed'
                  ? theme.palette.success.main
                  : theme.palette.primary.main
            }}
          >
            {order?.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Loading...'}
          </Box>
        </Typography>
      </Box>
    </Paper>
  );
};

export default OrderStatusTracker; 
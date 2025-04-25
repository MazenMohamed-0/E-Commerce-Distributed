import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Divider
} from '@mui/material';

const CartSummary = ({ total, onCheckout }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Order Summary
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography>Subtotal</Typography>
          <Typography>${total.toFixed(2)}</Typography>
        </Box>
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Typography>Shipping</Typography>
          <Typography>Calculated at checkout</Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box display="flex" justifyContent="space-between" mb={3}>
          <Typography variant="h6">Total</Typography>
          <Typography variant="h6">${total.toFixed(2)}</Typography>
        </Box>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          size="large"
          onClick={onCheckout}
        >
          Proceed to Checkout
        </Button>
      </CardContent>
    </Card>
  );
};

export default CartSummary; 
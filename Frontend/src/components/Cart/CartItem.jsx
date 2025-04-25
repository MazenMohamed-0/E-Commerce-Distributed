import React, { useState } from 'react';
import {
  Box,
  Card,
  CardMedia,
  Typography,
  IconButton,
  TextField,
  Stack,
  Alert,
  Snackbar
} from '@mui/material';
import { Add, Remove, Delete } from '@mui/icons-material';
import { useCart } from '../../context/CartContext';

const CartItem = ({ item }) => {
  const { updateQuantity, removeFromCart } = useCart();
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleQuantityChange = async (newQuantity) => {
    console.log('1. handleQuantityChange called with:', newQuantity, 'type:', typeof newQuantity);
    
    if (isUpdating) {
      console.log('Already updating, skipping...');
      return;
    }
    
    try {
      setIsUpdating(true);
      console.log('2. Current item:', item);
      
      // Convert to number and validate
      let validQuantity = Number(newQuantity);
      console.log('3. Converted to Number:', validQuantity, 'type:', typeof validQuantity);

      // Check for NaN and validate range
      if (isNaN(validQuantity)) {
        console.error('4a. Invalid quantity (NaN)');
        throw new Error('Invalid quantity value');
      }

      // Ensure within valid range (1 to stock)
      validQuantity = Math.max(1, Math.min(validQuantity, item.stock));
      console.log('4b. After range validation:', validQuantity);
      
      // Only update if quantity has changed and is valid
      if (validQuantity === item.quantity || isNaN(validQuantity)) {
        console.log('5a. No change in quantity or invalid value, skipping update');
        return;
      }

      console.log('5b. Calling updateQuantity with:', {
        productId: item.productId,
        quantity: validQuantity,
        currentQuantity: item.quantity
      });

      await updateQuantity(item.productId, validQuantity);
      console.log('6. Update successful');
      setError(null);
    } catch (error) {
      console.error('7. CartItem update error:', error);
      setError(error.response?.data?.message || error.message || 'Error updating quantity');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInputChange = (e) => {
    console.log('handleInputChange:', {
      value: e.target.value,
      type: typeof e.target.value
    });
    
    const value = e.target.value.trim();
    if (value === '') return;
    
    const numValue = Number(value);
    console.log('Parsed input value:', numValue);
    
    if (!isNaN(numValue)) {
      handleQuantityChange(numValue);
    }
  };

  const handleIncrement = () => {
    console.log('Increment clicked:', {
      currentQuantity: item.quantity,
      stock: item.stock
    });
    handleQuantityChange(item.quantity + 1);
  };

  const handleDecrement = () => {
    console.log('Decrement clicked:', {
      currentQuantity: item.quantity
    });
    if (item.quantity > 1) {
      handleQuantityChange(Math.max(1, item.quantity - 1));
    }
  };

  const handleRemove = () => {
    removeFromCart(item.productId);
  };

  return (
    <>
      <Card sx={{ display: 'flex', mb: 2, p: 2 }}>
        <Box sx={{ width: 150, height: 150, position: 'relative' }}>
          <CardMedia
            component="img"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              backgroundColor: '#f5f5f5',
              borderRadius: 1
            }}
            image={item.imageUrl || 'https://via.placeholder.com/150'}
            alt={item.name}
          />
        </Box>
        
        <Box sx={{ display: 'flex', flexGrow: 1, ml: 3 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {item.name}
            </Typography>
            <Typography variant="h6" color="primary" sx={{ mb: 1 }}>
              ${item.price.toFixed(2)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {item.stock} items available
            </Typography>
          </Box>

          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton
              size="small"
              onClick={handleDecrement}
              disabled={item.quantity <= 1 || isUpdating}
            >
              <Remove />
            </IconButton>
            
            <TextField
              size="small"
              value={item.quantity}
              onChange={handleInputChange}
              disabled={isUpdating}
              type="number"
              inputProps={{
                min: 1,
                max: item.stock,
                style: { textAlign: 'center', width: '40px' }
              }}
            />
            
            <IconButton
              size="small"
              onClick={handleIncrement}
              disabled={item.quantity >= item.stock || isUpdating}
            >
              <Add />
            </IconButton>

            <IconButton
              color="error"
              onClick={handleRemove}
              disabled={isUpdating}
              sx={{ ml: 2 }}
            >
              <Delete />
            </IconButton>
          </Stack>
        </Box>
      </Card>
      
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export default CartItem; 
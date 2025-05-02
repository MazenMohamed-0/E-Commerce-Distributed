import React, { useState } from 'react';
import {
  Typography,
  Box,
  Chip,
  Divider,
  Button,
  TextField,
  IconButton
} from '@mui/material';
import { ShoppingCart, Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { useCart } from '../../context/CartContext';

const ProductInfo = ({ product }) => {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1 || newQuantity > product.stock) return;
    setQuantity(newQuantity);
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {product.name}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h5" color="primary" gutterBottom>
          ${product.price.toFixed(2)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Chip 
          label={product.stock > 0 ? `${product.stock} items in Stock` : 'Out of Stock'} 
          color={product.stock > 0 ? 'success' : 'error'}
          sx={{ width: 'fit-content' }}
        />
        {product.stock > 0 && (
          <Typography variant="body2" color="text.secondary">
            Maximum purchase quantity: {product.stock} items
          </Typography>
        )}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Description
        </Typography>
        <Typography variant="body1" paragraph>
          {product.description}
        </Typography>
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1">Sold by:</Typography>
        <Typography variant="subtitle1" color="primary">
          {product.seller?.storeName || 'Unknown Store'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1">Category:</Typography>
        <Chip label={product.category} />
      </Box>

      {product.stock > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
            >
              <RemoveIcon />
            </IconButton>
            <TextField
              size="small"
              value={quantity}
              inputProps={{ min: 1, max: product.stock, style: { textAlign: 'center' } }}
              sx={{ width: '60px' }}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value))}
            />
            <IconButton
              size="small"
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={quantity >= product.stock}
            >
              <AddIcon />
            </IconButton>
          </Box>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<ShoppingCart />}
            onClick={handleAddToCart}
            sx={{ flex: 1 }}
          >
            Add to Cart
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ProductInfo; 
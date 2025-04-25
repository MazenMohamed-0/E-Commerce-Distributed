import React from 'react';
import { Box } from '@mui/material';

const ProductImage = ({ imageUrl, name }) => {
  return (
    <Box
      component="img"
      src={imageUrl}
      alt={name}
      sx={{
        width: '100%',
        height: 'auto',
        objectFit: 'cover',
        borderRadius: 2
      }}
    />
  );
};

export default ProductImage; 
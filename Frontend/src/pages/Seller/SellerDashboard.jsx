import React from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import ProductManagement from '../../components/Seller/ProductManagement';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/hooks';

const SellerDashboard = () => {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h4" gutterBottom>
              {user?.storeName || 'Seller Dashboard'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your products and view your store statistics
            </Typography>
          </Paper>
          <ProductManagement />
        </Box>
      </Container>
    </>
  );
};

export default SellerDashboard; 
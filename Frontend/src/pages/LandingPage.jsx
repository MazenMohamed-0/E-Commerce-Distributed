import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  Grid,
  Card,
  Icon,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

const features = [
  {
    icon: <ShoppingCartIcon color="primary" sx={{ fontSize: 40 }} />,
    title: 'Convenience',
    description:
      'Shop anytime, anywhere with just a few clicks.',
  },
  {
    icon: <StorefrontIcon color="primary" sx={{ fontSize: 40 }} />,
    title: 'Wide Selection',
    description:
      'Access a vast range of products from multiple sellers.',
  },
  {
    icon: <AttachMoneyIcon color="primary" sx={{ fontSize: 40 }} />,
    title: 'Competitive Pricing',
    description:
      'Compare prices and get the best deals online.',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  // Animation Variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const staggerContainer = {
    hidden: { opacity: 1 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  return (
    <>
      <Box
        component={motion.div}
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        sx={{ py: 8, textAlign: 'center', backgroundColor: 'background.default' }}
      >
        <Container maxWidth="lg">
          <Typography variant="h2" gutterBottom>
            Welcome to SAWA'LY
          </Typography>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            One Of The Best E-Commerce In The Middle East.
          </Typography>
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={() => navigate('/home')}
              component={motion.button}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              Browse Our Products
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              onClick={() => navigate('/login')}
              component={motion.button}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              Sign In
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Box
        component={motion.div}
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        sx={{ py: 8, backgroundColor: 'background.paper' }}
      >
        <Container>
          <Typography variant="h3" gutterBottom textAlign="center">
            Why Choose Us
          </Typography>
          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid
                item
                xs={12}
                md={4}
                key={index}
                component={motion.div}
                variants={fadeInUp}
              >
                <Card elevation={3} sx={{ p: 3, textAlign: 'center' }}>
                  <Icon color="primary" sx={{ fontSize: 48, mb: 2 }}>
                    {feature.icon}
                  </Icon>
                  <Typography variant="h5" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography color="textSecondary">{feature.description}</Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Call to Action Section */}
      <Box
        component={motion.div}
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        sx={{ py: 8, textAlign: 'center', backgroundColor: 'background.default' }}
      >
        <Container>
          <Typography variant="h3" gutterBottom>
            Want To Become One Of Our Sellers?
          </Typography>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            Join thousands of satisfied users who have transformed their Market experience with SAWA'LY.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => navigate('/register')}
            component={motion.button}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            Signup Now 
          </Button>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 4, textAlign: 'center', backgroundColor: 'background.paper' }}>
        <Typography variant="body2" color="textSecondary">
          © {new Date().getFullYear()} SAWA'LY. All rights reserved.
        </Typography>
      </Box>
    </>
  );
};

export default LandingPage;
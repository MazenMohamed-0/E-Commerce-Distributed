import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  Card,
  Grid,
  TextField,
  Button,
  Typography,
  Box,
  Divider,
  Alert,
  Icon,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import { motion } from 'framer-motion';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';



const eCommerceAdvantages = [
  {
    icon: <ShoppingCartIcon color="primary" sx={{ fontSize: 40 }} />,
    title: 'Convenience',
    description: 'Shop anytime, anywhere with just a few clicks.',
  },
  {
    icon: <StorefrontIcon color="primary" sx={{ fontSize: 40 }} />,
    title: 'Wide Selection',
    description: 'Access a vast range of products from multiple sellers.',
  },
  {
    icon: <AttachMoneyIcon color="primary" sx={{ fontSize: 40 }} />,
    title: 'Competitive Pricing',
    description: 'Compare prices and get the best deals online.',
  },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, handleOAuthLogin, getProfile } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState('');
  const [notification, setNotification] = useState('');
  const location = useLocation();

  // Check for notification in location state (from signup redirect)
  useEffect(() => {
    if (location.state?.notification) {
      setNotification(location.state.notification);
      // Clean up the state after showing notification
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  // Check for error in URL (from OAuth redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
      setErrorMessage(decodeURIComponent(error));
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Update error message when error from AuthContext changes
  useEffect(() => {
    if (error) {
      setErrorMessage(error);
    }
  }, [error]);

  // Check for token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      console.log('OAuth Token received:', token);
      // Save token to localStorage first
      localStorage.setItem('token', token);
      console.log('Token saved to localStorage');
      
      // Then handle OAuth login
      handleOAuthLogin(token)
        .then(() => {
          console.log('OAuth login successful, navigating...');
          // Only clean URL after successful login
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/');
        })
        .catch(err => {
          console.error('OAuth login error:', err);
          // Clear token on error
          localStorage.removeItem('token');
          setErrorMessage(err.message || 'OAuth login failed');
        });
    }
  }, [navigate, handleOAuthLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      const response = await login(email, password);
      
      // If it's a pending seller, show the message and stay on login page
      if (response.pendingSeller) {
        setErrorMessage(response.message);
        return;
      }

      // Redirect based on role
      if (response.user.role === 'seller') {
        navigate('/seller');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Login failed');
    }
  };

  const handleGoogleLogin = () => {
    const width = 600;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      'http://localhost:3001/auth/google',
      'Google Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    const handleMessage = async (event) => {
      // Check for both origins since the popup might be on either
      if (event.origin !== 'http://localhost:3001' && event.origin !== 'http://localhost:5173') {
        console.log('Ignoring message from unknown origin:', event.origin);
        return;
      }
      
      console.log('Received OAuth message:', event.data);
      
      const { token, error, needsRoleSelection } = event.data;
      
      if (error) {
        console.error('OAuth error:', error);
        setErrorMessage(error);
        popup?.close();
        return;
      }
      
      if (token) {
        try {
          // Save token and handle login
          localStorage.setItem('token', token);
          const needsRole = await handleOAuthLogin(token);
          
          if (needsRole) {
            // If there's an error message, it means the seller account is not approved
            if (error) {
              // Stay on login page and show the error message
              setErrorMessage(error);
            } else {
              // Otherwise, navigate to role selection
              navigate('/select-role');
            }
          } else {
            // Get user profile to check role
            const user = await getProfile();
            if (user.role === 'seller') {
              navigate('/seller');
          } else {
            navigate('/');
            }
          }
        } catch (err) {
          console.error('Login error:', err);
          setErrorMessage(err.message || 'Login failed');
        }
        popup?.close();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  };

  const handleFacebookLogin = () => {
    const width = 600;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      'http://localhost:3001/auth/facebook',
      'Facebook Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    const handleMessage = (event) => {
      if (event.origin !== 'http://localhost:5173') return;
      
      if (event.data.type === 'OAUTH_ERROR') {
        setErrorMessage(event.data.error);
        popup.close();
        return;
      }

      if (event.data.type === 'OAUTH_TOKEN') {
        const { token, needsRoleSelection } = event.data;
        if (needsRoleSelection) {
          navigate('/select-role');
        } else {
          navigate('/');
        }
        popup.close();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  };

// Animation for the page
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const staggerContainer = {
    hidden: { opacity: 1 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Grid container spacing={4} alignItems="center" justifyContent="center">
        {/* Left Side Content */}
        <Grid item xs={12} 
        md={6} 
        component={motion.div} // Add animation to the left side
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        sx={{ display: { xs: 'none', md: 'block' } }}
        >
          <Typography 
          variant="h3" 
          fontWeight="bold" 
          gutterBottom
          component={motion.div}
          variants={fadeInUp}
            >
            Why Choose SAWA'LY?
          </Typography>
          {eCommerceAdvantages.map((advantage, index) => (
            <Box 
            key={index} 
            sx={{ mb: 4 }}
            component={motion.div}
            variants={fadeInUp}
            >
              {advantage.icon}
              <Box>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {advantage.title}
                </Typography>
                <Typography variant="body1" color="textSecondary">
                  {advantage.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Grid>

        {/* Right Side Login Form */}
        <Grid 
          item 
          xs={12} 
          md={6}
          component={motion.div} 
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          >
          <Card sx={{ p: 4, boxShadow: 3, borderRadius: 4 }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Sign In
            </Typography>
            {notification && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {notification}
              </Alert>
            )}
            {errorMessage && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorMessage}
              </Alert>
            )}
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                required
                id="email"
                label="Email Address"
                type="email"
                name="email"
                autoComplete="email"
                autoFocus
                placeholder="your@email.com"
                variant="outlined"
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                placeholder="Your Password"
                variant="outlined"
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                fullWidth
                variant="contained"
                color="primary"
                type="submit"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <Divider sx={{ my: 2 }}>or</Divider>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<GoogleIcon />}
                onClick={handleGoogleLogin}
                sx={{ mb: 2 }}
              >
                Sign in with Google
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<FacebookIcon />}
                onClick={handleFacebookLogin}
              >
                Sign in with Facebook
              </Button>
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2">
                  Don't have an account?{' '}
                  <Button
                    variant="text"
                    color="primary"
                    onClick={() => navigate('/register')}
                    sx={{ textTransform: 'none' }}
                  >
                    Sign up
                  </Button>
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Login; 



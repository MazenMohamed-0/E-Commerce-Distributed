import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Divider,
  Alert,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import config from '../config';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';

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

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          Sign In
        </Typography>
        
        {notification && (
          <Alert 
            severity="success" 
            sx={{ 
              width: '100%', 
              mt: 2,
              mb: 2,
              '& .MuiAlert-message': {
                width: '100%',
                textAlign: 'left'
              }
            }}
            onClose={() => setNotification('')}
          >
            {notification}
          </Alert>
        )}

        {errorMessage && (
          <Alert 
            severity="error" 
            sx={{ 
              width: '100%', 
              mt: 2,
              mb: 2,
              '& .MuiAlert-message': {
                width: '100%',
                textAlign: 'left'
              }
            }}
          >
            {errorMessage}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign In
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleGoogleLogin}
            sx={{ mb: 2 }}
            startIcon={<GoogleIcon />}
          >
            Sign in with Google
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleFacebookLogin}
            startIcon={<FacebookIcon />}
          >
            Sign in with Facebook
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default Login; 
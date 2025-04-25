import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Divider,
  Alert,
  MenuItem,
} from '@mui/material';
import { useAuth } from '../context/hooks';
import config from '../config';

const Register = () => {
  // Form refs
  const nameRef = useRef('');
  const emailRef = useRef('');
  const passwordRef = useRef('');
  const confirmPasswordRef = useRef('');
  const storeNameRef = useRef('');
  const taxNumberRef = useRef('');
  const storeDescriptionRef = useRef('');
  const contactNumberRef = useRef('');

  const [role, setRole] = useState('buyer');
  const [error, setError] = useState('');
  const { register, loading, handleOAuthLogin } = useAuth();
  const navigate = useNavigate();

  // Check for token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      console.log('OAuth Token:', token);
      handleOAuthLogin(token)
        .then(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/');
        })
        .catch(err => {
          console.error('OAuth login error:', err);
          setError(err.message || 'OAuth login failed');
        });
    }
  }, [navigate, handleOAuthLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const name = nameRef.current.value;
      const email = emailRef.current.value;
      const password = passwordRef.current.value;
      const confirmPassword = confirmPasswordRef.current.value;

      // Basic validation
      if (!name || !email || !password) {
        setError('Please fill in all required fields');
        return;
      }

      // Password confirmation check
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      // Create registration data
      const userData = {
        name: name.trim(),
        email: email.trim(),
        password: password,
        role: role
      };

      // Add seller fields if role is seller
      if (role === 'seller') {
        const storeName = storeNameRef.current.value;
        const taxNumber = taxNumberRef.current.value;

        if (!storeName || !taxNumber) {
          setError('Store name and tax number are required for sellers');
          return;
        }

        userData.storeInfo = {
          storeName: storeName.trim(),
          taxNumber: taxNumber.trim(),
          storeDescription: storeDescriptionRef.current?.value?.trim() || '',
          contactNumber: contactNumberRef.current?.value?.trim() || '',
          status: 'pending'
        };
      }

      try {
        const response = await register(userData);
        
        // For seller accounts with pending status
        if (response.message && role === 'seller') {
          // Show the pending approval message and redirect immediately
          navigate('/login', { 
            state: { 
              notification: 'Registration successful! Your seller account is pending approval. Please wait for admin verification.' 
            }
          });
          return;
        }

        // For successful registration with token
        if (response.token) {
          navigate('/');
        }
      } catch (registerError) {
        console.error('Registration process error:', registerError);
        
        // For seller accounts with pending status
        if (registerError.message && registerError.message.includes('pending approval')) {
          navigate('/login', { 
            state: { 
              notification: 'Registration successful! Your seller account is pending approval. Please wait for admin verification.' 
            }
          });
          return;
        }
        
        // For other errors
        setError(registerError.message || 'Failed to create account');
      }
    } catch (err) {
      console.error('Registration form error:', err);
      setError(err.response?.data?.message || 'Failed to create account');
    }
  };

  const openOAuthPopup = (url) => {
    const width = 600;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    return window.open(
      url,
      'oauth_popup',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const handleGoogleRegister = () => {
    const popup = openOAuthPopup('http://localhost:3001/auth/google?type=register');

    const handleMessage = async (event) => {
      if (event.origin !== 'http://localhost:3001' && event.origin !== 'http://localhost:5173') {
        console.log('Ignoring message from unknown origin:', event.origin);
        return;
      }
      
      console.log('Received OAuth message:', event.data);
      
      const { token, error } = event.data;
      
      if (error) {
        console.error('OAuth error:', error);
        setError(error);
        popup?.close();
        return;
      }
      
      if (token) {
        try {
          localStorage.setItem('token', token);
          const needsRole = await handleOAuthLogin(token);
          
          if (needsRole) {
            navigate('/select-role');
          } else {
            navigate('/');
          }
        } catch (err) {
          console.error('Registration error:', err);
          setError(err.message || 'Registration failed');
        }
        popup?.close();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  };

  const handleFacebookRegister = () => {
    const fbPopup = openOAuthPopup(`${config.BACKEND_URL}/auth/facebook`);
    
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_TOKEN') {
        const { token } = event.data;
        console.log('Received OAuth token from popup:', token);
        
        localStorage.setItem('token', token);
        handleOAuthLogin(token)
          .then((needsRole) => {
            console.log('OAuth registration result - needs role:', needsRole);
            if (needsRole) {
              console.log('Navigating to role selection...');
              navigate('/select-role');
            } else {
              console.log('Navigating to home...');
              navigate('/');
            }
          })
          .catch(err => {
            console.error('OAuth login error:', err);
            setError(err.message || 'OAuth registration failed');
          });
        fbPopup?.close();
      } else if (event.data.type === 'OAUTH_ERROR') {
        console.error('OAuth error:', event.data.error);
        setError(event.data.error || 'OAuth registration failed');
        fbPopup?.close();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Sign Up
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Name"
            inputRef={nameRef}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            inputRef={emailRef}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            inputRef={passwordRef}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            inputRef={confirmPasswordRef}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            margin="normal"
          >
            <MenuItem value="buyer">Buyer</MenuItem>
            <MenuItem value="seller">Seller</MenuItem>
          </TextField>

          {/* Seller-specific fields */}
          {role === 'seller' && (
            <>
              <TextField
                fullWidth
                label="Store Name"
                inputRef={storeNameRef}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Tax Number"
                inputRef={taxNumberRef}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Store Description"
                inputRef={storeDescriptionRef}
                margin="normal"
                multiline
                rows={4}
              />
              <TextField
                fullWidth
                label="Contact Number"
                inputRef={contactNumberRef}
                margin="normal"
              />
            </>
          )}

          <Button
            fullWidth
            variant="contained"
            color="primary"
            type="submit"
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </Button>
        </form>
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2">
            Already have an account? <Link to="/login">Login</Link>
          </Typography>
        </Box>
        <Divider sx={{ my: 3 }}>OR</Divider>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            color="primary"
            onClick={handleGoogleRegister}
            disabled={loading}
          >
            Sign up with Google
          </Button>
          <Button
            fullWidth
            variant="outlined"
            color="primary"
            onClick={handleFacebookRegister}
            disabled={loading}
          >
            Sign up with Facebook
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;
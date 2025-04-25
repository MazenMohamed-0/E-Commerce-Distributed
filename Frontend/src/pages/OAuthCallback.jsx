import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/hooks';
import { Box, CircularProgress, Typography } from '@mui/material';

const OAuthCallback = () => {
  const { handleOAuthLogin } = useAuth();
  const navigate = useNavigate();

  const handleCallback = useCallback(async () => {
    try {
      // Get token and type from URL
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const error = urlParams.get('error');

      if (error) {
        navigate('/login?error=' + encodeURIComponent(error));
        return;
      }

      if (!token) {
        throw new Error('No token received');
      }

      // Handle OAuth login
      const needsRoleSelection = await handleOAuthLogin(token);
      
      if (needsRoleSelection) {
        navigate('/select-role');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      navigate('/login?error=' + encodeURIComponent(error.message || 'OAuth login failed'));
    }
  }, [handleOAuthLogin, navigate]);

  useEffect(() => {
    handleCallback();
  }, [handleCallback]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
      <Typography variant="h6" sx={{ mt: 2 }}>
        Completing authentication...
      </Typography>
    </Box>
  );
};

export default OAuthCallback;
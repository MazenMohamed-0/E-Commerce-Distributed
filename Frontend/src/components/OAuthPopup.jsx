import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OAuthPopup = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for messages from the popup
    const handleMessage = async (event) => {
      // Verify the origin of the message
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_TOKEN') {
        const { token } = event.data;
        console.log('Received OAuth token from popup');
        
        try {
          // Validate token structure
          if (!token || typeof token !== 'string') {
            throw new Error('Invalid token format received');
          }

          // Save token to localStorage
          localStorage.setItem('token', token);
          console.log('Token saved successfully');
          
          // Post a success message back to the opener
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_SUCCESS', token }, window.location.origin);
          }
          
          // Close the popup
          window.close();
        } catch (error) {
          console.error('Error handling OAuth token:', error);
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_ERROR', error: error.message }, window.location.origin);
          }
          window.close();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Completing Authentication...</h2>
      <p>Please wait while we complete your authentication.</p>
    </div>
  );
};

export default OAuthPopup; 
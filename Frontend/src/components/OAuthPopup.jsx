import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OAuthPopup = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for messages from the popup
    const handleMessage = (event) => {
      // Verify the origin of the message
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'OAUTH_TOKEN') {
        const { token } = event.data;
        console.log('Received OAuth token from popup:', token);
        
        // Save token to localStorage
        localStorage.setItem('token', token);
        
        // Close the popup
        window.close();
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
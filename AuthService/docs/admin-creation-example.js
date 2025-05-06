/**
 * Example code for creating an admin user
 * Run with: node admin-creation-example.js
 */

const axios = require('axios');

async function createAdmin() {
  try {
    const response = await axios.post('http://localhost:3001/auth/register-admin', {
      name: 'System Admin',
      email: 'admin@example.com',
      password: 'securePassword123',
      secretKey: 'admin-secret-key-for-registration', // Use the value from your ADMIN_SECRET_KEY env var
      superAdmin: true
    });

    console.log('Admin created successfully!');
    console.log('User details:', response.data.user);
    console.log('JWT Token:', response.data.token);
    
    // Store this token securely for future admin operations
    // You can now use this token for authenticated admin API calls
    
  } catch (error) {
    console.error('Error creating admin:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
  }
}

createAdmin(); 
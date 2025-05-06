/**
 * Development server for EmailService
 * This script creates a local HTTP server that wraps the Cloud Function
 * so it can be tested locally or run in Docker
 */
const http = require('http');
const { sendOrderConfirmation } = require('./index');

// Set environment variable for development
process.env.NODE_ENV = 'development';

const PORT = process.env.PORT || 8081;

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  // Only handle POST requests to /sendOrderConfirmation
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed' 
    }));
    return;
  }
  
  // Parse request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      // Parse JSON body
      const requestData = JSON.parse(body);
      
      // Create mock response object
      const mockRes = {
        set: () => {},
        status: (code) => ({
          send: (data) => {
            res.statusCode = code;
            res.end(data);
          },
          json: (data) => {
            res.statusCode = code;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          }
        })
      };
      
      // Create mock request object
      const mockReq = {
        method: 'POST',
        body: requestData
      };
      
      // Call the Cloud Function
      console.log('Calling email function with:', JSON.stringify(requestData, null, 2));
      await sendOrderConfirmation(mockReq, mockRes);
      
    } catch (error) {
      console.error('Error processing request:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        success: false, 
        error: error.message 
      }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Development server running at http://localhost:${PORT}`);
  console.log('Send POST requests to http://localhost:${PORT}/sendOrderConfirmation');
});

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 
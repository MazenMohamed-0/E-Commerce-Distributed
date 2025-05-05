const nodemailer = require('nodemailer');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

// Create Secret Manager client
const secretClient = new SecretManagerServiceClient();

// Cache for secret values to avoid frequent API calls
let emailSecrets = null;

/**
 * Retrieves secrets from Google Cloud Secret Manager
 * @param {string} secretName - Name of the secret to retrieve
 * @returns {Promise<string>} - Secret value
 */
async function getSecret(secretName) {
  try {
    // Check for PROJECT_ID environment variable
    const projectId = process.env.PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    
    if (!projectId) {
      console.error('PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable is not set');
      
      // For development environment, fall back to environment variables
      if (process.env.NODE_ENV === 'development') {
        if (secretName === 'email-service-address' && process.env.EMAIL_ADDRESS) {
          console.log('Using EMAIL_ADDRESS from environment variable');
          return process.env.EMAIL_ADDRESS;
        }
        if (secretName === 'email-service-password' && process.env.EMAIL_PASSWORD) {
          console.log('Using EMAIL_PASSWORD from environment variable');
          return process.env.EMAIL_PASSWORD;
        }
      }
      
      throw new Error('GCP Project ID is not defined. Set PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable.');
    }
    
    // Get the full secret name
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    console.log(`Accessing secret: ${secretName} from project: ${projectId}`);
    
    // Access the secret
    const [response] = await secretClient.accessSecretVersion({ name });
    
    // Get the secret value
    return response.payload.data.toString('utf8');
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error);
    throw error;
  }
}

/**
 * Initializes the email transporter with Gmail credentials
 * @returns {Promise<nodemailer.Transporter>} - Configured nodemailer transporter
 */
async function createTransporter() {
  // If secrets are already cached, use them
  if (emailSecrets) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailSecrets.email,
        pass: emailSecrets.password
      }
    });
  }

  try {
    // Get secrets from Secret Manager
    const email = await getSecret('email-service-address');
    const password = await getSecret('email-service-password');
    
    // Cache the secrets
    emailSecrets = { email, password };
    
    // Create and return the transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: email,
        pass: password
      }
    });

    // Add this to the createTransporter function
    console.log('Testing direct SMTP connection to Gmail...');
    const testConnection = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: email,
        pass: password
      },
      debug: true
    });
    
    try {
      await testConnection.verify();
      console.log('SMTP connection successful');
    } catch (error) {
      console.error('SMTP connection failed:', error.message);
    }

    return transporter;
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    throw new Error('Email service configuration failed');
  }
}

/**
 * Formats shipping address for email
 * @param {Object} address - Shipping address object
 * @returns {string} - Formatted address string
 */
function formatShippingAddress(address) {
  if (!address) return 'No address provided';
  
  const parts = [
    address.fullName,
    address.addressLine1,
    address.addressLine2,
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country,
    `Phone: ${address.phoneNumber}`
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Cloud Function to send order confirmation emails
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 * @returns {Promise<Object>} - Response object
 */
exports.sendOrderConfirmation = async (req, res) => {
  // Set CORS headers for preflight requests
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  
  // Verify request is a POST
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  
  try {
    console.log('🔔 Email function triggered');
    
    // Get order and user details from request body
    const { order, userEmail } = req.body;
    
    // Validate required fields
    if (!order || !userEmail) {
      console.error('❌ Missing required fields: order and userEmail');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: order and userEmail'
      });
    }
    
    // Validate email format using a simple regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      console.error(`❌ Invalid email format: ${userEmail}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    
    // Log the email being used
    console.log(`📧 Sending email to: ${userEmail} for order ${order._id}`);
    
    // Create transporter
    const transporter = await createTransporter();
    
    // Format shipping address
    const formattedAddress = formatShippingAddress(order.shippingAddress);
    
    // Format order items for HTML email
    const itemsHtml = order.items.map(item => `      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">
          ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.productName || 'Product'}" style="width: 80px; height: 80px; object-fit: contain; display: block; margin-bottom: 5px;">` : 
          '<div style="width: 80px; height: 80px; background-color: #f0f0f0; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;"><span style="color: #888; font-size: 12px;">No Image</span></div>'}
          ${item.productName || item.productId}
        </td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${item.price.toFixed(2)}</td>
        <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');
    
    // Create email content
    const mailOptions = {
      from: `"E-Commerce Store" <${emailSecrets.email}>`,
      to: userEmail, // Send to the provided user email
      subject: `Order Confirmation #${order._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a4a4a;">Thank you for your order!</h2>
          
          <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #2a2a2a;">Order Details</h3>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Date:</strong> ${new Date(order.createdAt || Date.now()).toLocaleString()}</p>
            <p><strong>Total Amount:</strong> $${order.totalAmount.toFixed(2)}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Payment Status:</strong> ${order.paymentStatus || 'Pending'}</p>
            <p><strong>Shipping Address:</strong> ${formattedAddress}</p>
          </div>
          
          <h3 style="color: #2a2a2a;">Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Product</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Price</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #f8f8f8;">
                <td colspan="3" style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>Total:</strong></td>
                <td style="padding: 10px; text-align: right; border: 1px solid #ddd;"><strong>$${order.totalAmount.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          <p style="margin-top: 20px;">Your order is being processed and will be shipped soon.</p>
          <p>Thank you for shopping with us!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #777; font-size: 0.9em;">
            <p>E-Commerce Store Team</p>
          </div>
        </div>
      `
    };
    
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${userEmail} with ID: ${info.messageId}`);
    
    // Return success response
    return res.status(200).json({
      success: true,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('❌ Failed to send order confirmation email:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// For testing the function locally
if (process.env.NODE_ENV === 'development') {
  const testOrder = {
    _id: '123456789',
    createdAt: new Date(),
    totalAmount: 125.99,
    paymentMethod: 'credit card',
    paymentStatus: 'Paid',
    shippingAddress: {
      fullName: 'John Doe',
      addressLine1: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      postalCode: '12345',
      country: 'USA',
      phoneNumber: '555-123-4567'
    },
    items: [
      { 
        productId: 'prod1', 
        productName: 'Product 1', 
        quantity: 2, 
        price: 25.99,
        imageUrl: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=Product1'
      },
      { 
        productId: 'prod2', 
        productName: 'Product 2', 
        quantity: 1, 
        price: 74.01,
        imageUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Product2'
      }
    ]
  };
  
  // Expose test function for local development
  exports.testSendEmail = async (email) => {
    try {
      const result = await this.sendOrderConfirmation(
        { 
          method: 'POST',
          body: { order: testOrder, userEmail: email }
        }, 
        {
          set: () => {},
          status: (code) => ({ 
            send: (msg) => console.log(`Status: ${code}, Message: ${msg}`),
            json: (data) => console.log(`Status: ${code}`, data)
          })
        }
      );
      return result;
    } catch (error) {
      console.error('Test email failed:', error);
    }
  };
} 

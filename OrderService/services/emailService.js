const nodemailer = require('nodemailer');
const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'email-service.log' }),
        new winston.transports.Console() // Add console transport for better debugging
    ]
});

// Hardcoded configuration - replace with your actual Gmail credentials
const EMAIL_CONFIG = {
    // The Gmail address to use for sending emails
    EMAIL_ADDRESS: process.env.EMAIL_ADDRESS || 'info@example.com', // Default sender address
    // App password generated from Google Account security settings
    APP_PASSWORD: process.env.EMAIL_PASSWORD || '', // Should be set in environment variables
    // Alternatively, use a testing service like Ethereal
    USE_TEST_ACCOUNT: false // Set to false to use actual Gmail account
};

// Alternative option - direct call to deployed cloud function URL
const CLOUD_FUNCTION_URL = process.env.EMAIL_SERVICE_URL || 'https://us-central1-precise-valor-457221-a5.cloudfunctions.net/sendOrderConfirmation';
// For local development, if we're running the local email service
const LOCAL_EMAIL_SERVICE_URL = 'http://localhost:8081';
// Check if we should use the local development server
const USE_LOCAL_EMAIL_SERVICE = false; // Set to false to prevent local server attempts
const USE_CLOUD_FUNCTION = true; // Set to true to use cloud function, false to use local nodemailer

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
        // Expose the URL for debugging
        this.CLOUD_FUNCTION_URL = CLOUD_FUNCTION_URL;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            if (EMAIL_CONFIG.USE_TEST_ACCOUNT) {
                // Create a test account on ethereal.email (fake SMTP service)
            const testAccount = await nodemailer.createTestAccount();
            
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                    secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            
                logger.info('Email test account created:', { user: testAccount.user });
                logger.info('View test emails at: https://ethereal.email/login');
            } else {
                // Use real Gmail account with app password
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: EMAIL_CONFIG.EMAIL_ADDRESS,
                        pass: EMAIL_CONFIG.APP_PASSWORD
                    }
                });
                
                logger.info('Created email transporter with Gmail');
            }
            
            this.initialized = true;
        } catch (error) {
            logger.error('Failed to initialize email service:', error);
            // Create a fallback transporter that just logs instead of sending
            this.transporter = {
                sendMail: (options) => {
                    logger.info('Email would be sent (not actually sending):', options);
                    return Promise.resolve({ messageId: 'dummy-id' });
                }
            };
        }
    }

    async sendOrderConfirmationEmail(order, userEmail) {
        console.log(`[EMAIL SERVICE] Received email request for order ${order?._id} to ${userEmail}`);
        logger.info(`Attempting to send order confirmation to ${userEmail}`);
        
        try {
            // First, try to use the local development server if enabled
            if (USE_LOCAL_EMAIL_SERVICE) {
                try {
                    console.log(`[EMAIL SERVICE] Attempting to use local development server at ${LOCAL_EMAIL_SERVICE_URL}`);
                    const result = await this.sendViaLocalDevelopmentServer(order, userEmail);
                    return result;
                } catch (localError) {
                    console.error(`[EMAIL SERVICE] Local development server failed, falling back to cloud function:`, localError.message);
                    // Fall through to cloud function
                }
            }
            
            if (USE_CLOUD_FUNCTION) {
                console.log(`[EMAIL SERVICE] Using Cloud Function approach at: ${CLOUD_FUNCTION_URL}`);
                return await this.sendViaCloudFunction(order, userEmail);
            } else {
                console.log(`[EMAIL SERVICE] Using direct Nodemailer approach`);
                return await this.sendViaNodemailer(order, userEmail);
            }
        } catch (error) {
            console.error(`[EMAIL SERVICE] Error sending email:`, error.message);
            // Additional error details for debugging
            if (error.response) {
                console.error(`[EMAIL SERVICE] Response status:`, error.response.status);
                console.error(`[EMAIL SERVICE] Response data:`, JSON.stringify(error.response.data));
            } else if (error.request) {
                console.error(`[EMAIL SERVICE] No response received, request:`, error.request._currentUrl);
            }
            logger.error('Failed to send order confirmation email:', error);
            return { success: false, error: error.message };
        }
    }

    async sendViaCloudFunction(order, userEmail) {
        try {
            if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@')) {
                console.error(`[EMAIL SERVICE] Invalid email format: ${userEmail}`);
                throw new Error('Invalid email address format');
            }
            
            // Sanitize and prepare order data
            const safeOrder = this.sanitizeOrderForEmail(order);
            console.log(`[EMAIL SERVICE] Order data sanitized for email, found ${safeOrder.items?.length || 0} items`);
            
            // Enhanced logging for debugging
            console.log(`[EMAIL SERVICE] Email recipient: ${userEmail}`);
            console.log(`[EMAIL SERVICE] Order ID: ${safeOrder._id}`);
            console.log(`[EMAIL SERVICE] User ID: ${safeOrder.userId}`);
            
            // Configure the request
            const config = {
                timeout: 10000, // 10 second timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // Log that we're making the request to the cloud function
            console.log(`[EMAIL SERVICE] Making request to Cloud Function at ${CLOUD_FUNCTION_URL}`);
            
            // Create a payload with the userEmail explicitly passed
            const payload = {
                order: safeOrder,
                userEmail: userEmail // Explicitly sending the user's email
            };
            
            console.log(`[EMAIL SERVICE] Sending payload with email: ${payload.userEmail}`);
            
            try {
                const response = await axios.post(CLOUD_FUNCTION_URL, payload, config);
                
                console.log(`[EMAIL SERVICE] ✅ Cloud Function response successful`);
                console.log(`[EMAIL SERVICE] Response status: ${response.status}`);
                console.log(`[EMAIL SERVICE] Response data: ${JSON.stringify(response.data)}`);
                logger.info('Cloud function response:', response.data);
                return { success: true, messageId: response.data.messageId || 'cloud-function-sent' };
            } catch (axiosError) {
                console.error(`[EMAIL SERVICE] ❌ Cloud Function request failed:`, axiosError.message);
                if (axiosError.response) {
                    console.error(`[EMAIL SERVICE] Response status: ${axiosError.response.status}`);
                    console.error(`[EMAIL SERVICE] Response data: ${JSON.stringify(axiosError.response.data)}`);
                } else if (axiosError.request) {
                    console.error(`[EMAIL SERVICE] No response received from cloud function`);
                }
                throw axiosError;
            }
        } catch (error) {
            console.error(`[EMAIL SERVICE] Cloud Function error:`, error.message);
            logger.error('Error calling cloud function:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    async sendViaNodemailer(order, userEmail) {
        await this.initialize();
        console.log(`[EMAIL SERVICE] Nodemailer initialized successfully`);
        
        // Sanitize and prepare order data
        const safeOrder = this.sanitizeOrderForEmail(order);
        console.log(`[EMAIL SERVICE] Order data sanitized for email, found ${safeOrder.items?.length || 0} items`);

            // Format the order items for the email
        const itemsList = safeOrder.items.map(item => {
            const productIdentifier = item.productName || item.productId || 'Unknown Product';
            const price = parseFloat(item.price) || 0;
            const quantity = parseInt(item.quantity) || 1;
            
            return `Product: ${productIdentifier} - Quantity: ${quantity} - Price: $${price.toFixed(2)}`;
        }).join('\n');

        // Format address
        const formattedAddress = this.formatShippingAddress(safeOrder.shippingAddress);
        console.log(`[EMAIL SERVICE] Address formatted: ${formattedAddress.substring(0, 50)}...`);

            // Create the email content
            const mailOptions = {
            from: `"E-Commerce Store" <${EMAIL_CONFIG.EMAIL_ADDRESS}>`,
                to: userEmail,
            subject: `Order Confirmation #${safeOrder._id}`,
                text: `
Thank you for your order!

Order Details:
--------------
Order ID: ${safeOrder._id}
Date: ${this.formatDate(safeOrder.createdAt)}
Total Amount: $${safeOrder.totalAmount.toFixed(2)}
Payment Method: ${safeOrder.paymentMethod || 'Standard'}
Shipping Address: ${formattedAddress}

Items:
------
${itemsList}

Your order is being processed and will be shipped soon.
Thank you for shopping with us!

E-Commerce Store Team
`,
            html: this.generateHtmlEmail(safeOrder, formattedAddress)
        };

        // Send the email
        console.log(`[EMAIL SERVICE] Sending email via Nodemailer to ${userEmail}`);
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[EMAIL SERVICE] Email sent successfully with ID: ${info.messageId}`);
        logger.info('Order confirmation email sent:', { messageId: info.messageId });
        
        // For ethereal.email, provide the URL where the email can be viewed
        if (info.messageUrl) {
            console.log(`[EMAIL SERVICE] Preview URL for test email: ${info.messageUrl}`);
            logger.info('Preview URL:', info.messageUrl);
            return {
                success: true,
                messageId: info.messageId,
                previewUrl: info.messageUrl
            };
        }
        
        return {
            success: true,
            messageId: info.messageId
        };
    }

    // New method to send via local development server
    async sendViaLocalDevelopmentServer(order, userEmail) {
        try {
            console.log('--------------------------------------------------');
            console.log(`[EMAIL SERVICE] ATTEMPTING TO SEND EMAIL VIA LOCAL SERVER`);
            console.log(`[EMAIL SERVICE] Local Server URL: ${LOCAL_EMAIL_SERVICE_URL}`);
            console.log(`[EMAIL SERVICE] Recipient Email: ${userEmail}`);
            console.log(`[EMAIL SERVICE] Order ID: ${order._id}`);
            console.log('--------------------------------------------------');
            
            // Format order data properly and handle edge cases
            const safeOrder = this.sanitizeOrderForEmail(order);
            
            // Call the local development server
            const config = {
                timeout: 10000, // 10 second timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            const response = await axios.post(LOCAL_EMAIL_SERVICE_URL, {
                order: safeOrder,
                userEmail
            }, config);
            
            console.log(`[EMAIL SERVICE] ✅ Local server response successful`);
            console.log(`[EMAIL SERVICE] Response status: ${response.status}`);
            console.log(`[EMAIL SERVICE] Response data: ${JSON.stringify(response.data)}`);
            
            return { success: true, messageId: response.data.messageId || 'local-server-sent' };
        } catch (error) {
            console.error(`[EMAIL SERVICE] Local server error:`, error.message);
            throw error;
        }
    }

    // Helper method to sanitize order data for email
    sanitizeOrderForEmail(order) {
        console.log(`[EMAIL SERVICE] Sanitizing order data`);
        // Handle MongoDB document conversion
        const orderObj = order.toObject ? order.toObject() : { ...order };
        
        // Ensure _id is a string
        if (orderObj._id) {
            orderObj._id = orderObj._id.toString ? orderObj._id.toString() : String(orderObj._id);
        } else {
            orderObj._id = 'Unknown';
        }
        
        // Ensure createdAt is a date
        if (!orderObj.createdAt) {
            orderObj.createdAt = new Date();
        }
        
        // Ensure totalAmount is a number
        orderObj.totalAmount = parseFloat(orderObj.totalAmount) || 0;
        
        // Ensure items array exists
        if (!Array.isArray(orderObj.items)) {
            orderObj.items = [];
            logger.warn(`Order ${orderObj._id} has no items array`);
        }
        
        // Process each item to ensure it has required fields
        orderObj.items = orderObj.items.map(item => {
            const safeItem = { ...item };
            
            // Ensure product ID and name
            safeItem.productId = safeItem.productId || 'Unknown';
            safeItem.productName = safeItem.productName || safeItem.productId || 'Unknown Product';
            
            // Ensure price and quantity are numbers
            safeItem.price = parseFloat(safeItem.price) || 0;
            safeItem.quantity = parseInt(safeItem.quantity) || 1;
            
            return safeItem;
        });
        
        // Ensure shipping address exists
        if (!orderObj.shippingAddress) {
            orderObj.shippingAddress = {};
        }
        
        return orderObj;
    }

    formatShippingAddress(address) {
        if (!address) return 'No address provided';
        
        const parts = [
            address.fullName || 'No name provided',
            address.addressLine1 || '',
            address.addressLine2 || '',
            address.city ? `${address.city}, ${address.state || ''} ${address.postalCode || ''}` : '',
            address.country || '',
            address.phoneNumber ? `Phone: ${address.phoneNumber}` : ''
        ].filter(Boolean);
        
        return parts.length > 0 ? parts.join(', ') : 'No address provided';
    }
    
    formatDate(dateValue) {
        try {
            const date = new Date(dateValue);
            return date.toLocaleString();
        } catch (e) {
            return new Date().toLocaleString();
        }
    }

    generateHtmlEmail(order, formattedAddress) {
        return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #4a4a4a;">Thank you for your order!</h2>
    
    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2a2a2a;">Order Details</h3>
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Date:</strong> ${this.formatDate(order.createdAt)}</p>
        <p><strong>Total Amount:</strong> $${order.totalAmount.toFixed(2)}</p>
        <p><strong>Payment Method:</strong> ${order.paymentMethod || 'Standard'}</p>
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
            ${order.items.map(item => `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.productName}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${item.price.toFixed(2)}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">$${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
            `).join('')}
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
`;
    }
}

const emailService = new EmailService();
module.exports = emailService;

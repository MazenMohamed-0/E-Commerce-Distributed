const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Create a test account if no real email credentials are provided
        this.createTransporter();
    }

    async createTransporter() {
        // For production, you would use real SMTP credentials
        // For development/testing, we'll use ethereal.email (fake SMTP service)
        try {
            // Create a test account on ethereal.email
            const testAccount = await nodemailer.createTestAccount();
            
            // Create a transporter using the test account
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            
            console.log('Email test account created:', testAccount.user);
            this.previewUrl = `https://ethereal.email/login`;
            console.log('View test emails at:', this.previewUrl);
            
        } catch (error) {
            console.error('Failed to create email transporter:', error);
            // Fallback to a dummy transporter that logs emails instead of sending
            this.transporter = {
                sendMail: (mailOptions) => {
                    console.log('Email would be sent with options:', mailOptions);
                    return Promise.resolve({ messageId: 'dummy-id' });
                }
            };
        }
    }

    async sendOrderConfirmation(order, userEmail) {
        try {
            if (!this.transporter) {
                await this.createTransporter();
            }

            // Format the order items for the email
            const itemsList = order.items.map(item => 
                `Product ID: ${item.productId} - Quantity: ${item.quantity} - Price: $${item.price.toFixed(2)}`
            ).join('\n');

            // Create the email content
            const mailOptions = {
                from: '"E-Commerce Store" <orders@ecommerce.com>',
                to: userEmail,
                subject: `Order Confirmation #${order._id}`,
                text: `
Thank you for your order!

Order Details:
--------------
Order ID: ${order._id}
Date: ${new Date(order.createdAt).toLocaleString()}
Total Amount: $${order.totalAmount.toFixed(2)}
Payment Method: ${order.paymentType}
Payment Status: ${order.paymentStatus}
Shipping Address: ${order.shippingAddress}

Items:
------
${itemsList}

Your order is being processed and will be shipped soon.
Thank you for shopping with us!

E-Commerce Store Team
`,
                html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #4a4a4a;">Thank you for your order!</h2>
    
    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #2a2a2a;">Order Details</h3>
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
        <p><strong>Total Amount:</strong> $${order.totalAmount.toFixed(2)}</p>
        <p><strong>Payment Method:</strong> ${order.paymentType}</p>
        <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
        <p><strong>Shipping Address:</strong> ${order.shippingAddress}</p>
    </div>
    
    <h3 style="color: #2a2a2a;">Items</h3>
    <table style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr style="background-color: #f0f0f0;">
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Product ID</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Price</th>
                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            ${order.items.map(item => `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.productId}</td>
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
`
            };

            // Send the email
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Order confirmation email sent:', info.messageId);
            
            // For ethereal.email, provide the URL where the email can be viewed
            if (info.messageUrl) {
                console.log('Preview URL:', info.messageUrl);
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
        } catch (error) {
            console.error('Failed to send order confirmation email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new EmailService();

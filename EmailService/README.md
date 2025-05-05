# Serverless Email Service for E-Commerce

This is a serverless email service built using Google Cloud Functions. It handles sending order confirmation emails for your e-commerce platform.

## Prerequisites

Before deploying this service, you'll need:

1. A Google Cloud Platform account
2. Google Cloud SDK installed on your machine
3. A Gmail account (for sending emails)
4. 2-step verification enabled on your Gmail account
5. An App Password for the Gmail account (create one at https://myaccount.google.com/apppasswords)

## Setup and Deployment

1. Clone this repository or create a new directory for this service
2. Copy all files from this directory into your project
3. Update the `PROJECT_ID` in `deploy.sh` with your Google Cloud project ID
4. Make the deployment script executable:
   ```
   chmod +x deploy.sh
   ```
5. Run the deployment script:
   ```
   ./deploy.sh
   ```
6. Follow the prompts to enter your Gmail address and app password

The script will:
- Enable the Secret Manager API if not already enabled
- Create secrets for your email credentials
- Deploy the function to Google Cloud
- Display the function's URL

## Integrating with the Order Service

To integrate this email service with your Order Service, modify your `orderService.js` to call the deployed function when an order is created or updated.

1. Add the function URL to your `.env` file:
   ```
   EMAIL_SERVICE_URL=https://your-function-url
   ```

2. Update your Order Service to call the email service:

```javascript
// In OrderService/services/orderService.js, add:
const axios = require('axios');

// Inside the createOrder function, after saving the order:
async function sendOrderConfirmationEmail(order, userEmail) {
  try {
    // Get user email from the order or fetch from user service
    const email = userEmail || await getUserEmail(order.userId);
    
    // Call the email service
    await axios.post(process.env.EMAIL_SERVICE_URL, {
      order,
      userEmail: email
    });
    
    console.log('Order confirmation email sent successfully');
  } catch (error) {
    // Don't fail the order if email fails
    console.error('Failed to send order confirmation email:', error.message);
  }
}
```

3. Call this function after an order is created or updated:

```javascript
// In the createOrder method:
const order = new Order({...});
await order.save();

// Send confirmation email
await sendOrderConfirmationEmail(order);
```

## Testing

To test the function locally:

1. Install dependencies:
   ```
   npm install
   ```

2. Set the local environment:
   ```
   export NODE_ENV=development
   ```

3. Run the function locally:
   ```
   npm run dev
   ```

4. Send a test request using curl or Postman:
   ```
   curl -X POST http://localhost:8080 \
     -H "Content-Type: application/json" \
     -d '{"order":{"_id":"test123","totalAmount":99.99,"items":[{"productName":"Test Product","quantity":1,"price":99.99}],"shippingAddress":{"fullName":"Test User","addressLine1":"123 Test St","city":"Test City","state":"TS","postalCode":"12345","country":"Test Country","phoneNumber":"555-123-4567"}},"userEmail":"your-email@example.com"}'
   ```

## Notes on Security

- The deployed function has open access (`--allow-unauthenticated`) for simplicity. For production, consider using authenticated access.
- Email credentials are stored securely in Google Cloud Secret Manager.
- Consider adding request validation and authentication to the function for production use.

## Troubleshooting

- If emails aren't being sent, check:
  - The Gmail account's security settings
  - That the App Password is correct
  - Google Cloud Function logs for any errors

## License

[Include your license information here]

## Production Email Services

For a production environment, consider using dedicated email sending services instead of Gmail:

1. **SendGrid** - Popular email service with generous free tier (100 emails/day)
   - Sign up at: https://sendgrid.com/
   - NodeJS documentation: https://docs.sendgrid.com/for-developers/sending-email/nodejs
   - Implementation example:
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   const msg = {
     to: 'user@example.com',
     from: 'service@yourdomain.com',
     subject: 'Order Confirmation',
     text: 'Plain text version',
     html: '<p>HTML version</p>',
   };
   await sgMail.send(msg);
   ```

2. **Mailgun** - Reliable email service for transactional emails
   - Sign up at: https://www.mailgun.com/
   - Free tier: 5,000 emails for 3 months

3. **Amazon SES** - Very cost-effective for high volume
   - Setup guide: https://aws.amazon.com/ses/
   - $0.10 per 1,000 emails

To implement any of these services, install the corresponding package and update the createTransporter function in index.js. 
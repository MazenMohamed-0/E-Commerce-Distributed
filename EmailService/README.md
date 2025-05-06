# Email Service

This service handles email notifications for the e-commerce platform, particularly order confirmation emails.

## Features

- Sends order confirmation emails with detailed order information
- Displays product images in the email for better visual confirmation
- Uses Google Cloud Secret Manager for secure credential storage
- Falls back to environment variables in development mode
- Can be run locally for development or deployed as a Google Cloud Function

## Recent Updates

- Added product images to order confirmation emails
- Updated message formatting for better readability
- Improved error handling and logging

## Environment Variables

For local development, create a `.env` file with the following:

```
# Required
NODE_ENV=development
PROJECT_ID=precise-valor-457221-a5

# Optional (only needed if not using GCP Secret Manager)
EMAIL_ADDRESS=your_gmail_address
EMAIL_PASSWORD=your_gmail_app_password
```

## Running Locally

### Direct Execution

```bash
npm install
npm run dev
```

The service will be available at http://localhost:8081

### Docker

```bash
docker build -t email-service .
docker run -p 8081:8081 -e NODE_ENV=development -e PROJECT_ID=precise-valor-457221-a5 email-service
```

## Deployment to Google Cloud Functions

```bash
gcloud functions deploy sendOrderConfirmation --runtime nodejs20 --trigger-http --allow-unauthenticated
```

## Testing

You can test the email service by sending a POST request to `/sendOrderConfirmation` with a payload like:

```json
{
  "order": {
    "_id": "123456789",
    "createdAt": "2023-06-01T12:00:00.000Z",
    "totalAmount": 125.99,
    "paymentMethod": "credit card",
    "paymentStatus": "Paid",
    "shippingAddress": {
      "fullName": "John Doe",
      "addressLine1": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "postalCode": "12345",
      "country": "USA",
      "phoneNumber": "555-123-4567"
    },
    "items": [
      { 
        "productId": "prod1", 
        "productName": "Product 1", 
        "quantity": 2, 
        "price": 25.99,
        "imageUrl": "https://example.com/product1.jpg"
      },
      { 
        "productId": "prod2", 
        "productName": "Product 2", 
        "quantity": 1, 
        "price": 74.01,
        "imageUrl": "https://example.com/product2.jpg"
      }
    ]
  },
  "userEmail": "test@example.com"
}
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
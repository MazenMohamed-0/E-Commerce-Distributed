# Order Service

The Order Service handles order creation, processing, and management for the e-commerce platform.

## Features

- Create and process orders
- Handle payments through Stripe integration
- Integrate with Product Service for inventory management
- Send order confirmation emails via serverless Email Service
- Event-driven architecture with RabbitMQ

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file based on `.env.example` and configure your environment variables:
   ```
   CONNECTION_STRING=your_mongodb_connection_string
   RABBITMQ_URL=your_rabbitmq_url
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   EMAIL_SERVICE_URL=your_email_service_url
   ```

3. Start the service:
   ```
   npm start
   ```

## Serverless Email Service Integration

This service integrates with a serverless email service built on Google Cloud Functions. When an order is created, it automatically sends a confirmation email to the customer.

To set up the email service:

1. Deploy the Email Service from the `EmailService` directory using the provided deployment script
2. Add the deployed function URL to your `.env` file as `EMAIL_SERVICE_URL`
3. The service will automatically send confirmation emails when orders are created

See the [EmailService README](../EmailService/README.md) for more details on setting up the serverless email component.

## API Endpoints

### GET /orders
- Lists all orders (admin only)

### GET /orders/my-orders
- Lists all orders for the authenticated user (buyer only)

### GET /orders/:id
- Gets a specific order by ID (if user owns the order or is admin)

### POST /orders
- Creates a new order
- Requires authentication
- Request body: 
  ```json
  {
    "items": [
      {
        "productId": "product_id",
        "quantity": 2
      }
    ],
    "shippingAddress": {
      "fullName": "John Doe",
      "addressLine1": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "postalCode": "12345",
      "country": "USA",
      "phoneNumber": "555-123-4567"
    },
    "paymentMethod": "stripe" // or "cash"
  }
  ```

### PATCH /orders/:id/status
- Updates an order's status (admin only)

### POST /orders/:id/cancel
- Cancels an order (buyer or admin)
- Request body:
  ```json
  {
    "reason": "Cancellation reason"
  }
  ``` 
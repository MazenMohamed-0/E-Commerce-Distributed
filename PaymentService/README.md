# Payment Service

This service handles payment processing for the e-commerce platform using PayPal.

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the PaymentService directory with the following content:

```
# Server Configuration
PORT=3005
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/payment-service

# RabbitMQ Configuration
RABBITMQ_URI=amqp://localhost:5672

# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
```

### 2. PayPal Sandbox Setup

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Log in or create an account
3. Go to "My Apps & Credentials"
4. Create a new Sandbox app
5. Copy the Client ID and Secret to your `.env` file

### 3. PayPal Sandbox Test Accounts

PayPal provides two types of test accounts:
- **Business account**: Used to receive payments
- **Personal account**: Used to make payments

To find these accounts:
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Navigate to "Accounts" under the Sandbox menu
3. You should see both account types listed there
4. Use the personal account email and password for testing payments

### 4. Starting the Service

```bash
# Install dependencies
npm install

# Start the service
npm start

# Start in development mode
npm run dev
```

## API Endpoints

### Create Payment
```
POST /payments/create
```
Request body:
```json
{
  "orderId": "order123",
  "userId": "user456",
  "amount": 99.99,
  "currency": "USD"
}
```

### Capture Payment
```
POST /payments/capture/:paypalOrderId
```

### Get Payment Status
```
GET /payments/status/:paymentId
```

### Get Payment by Order ID
```
GET /payments/order/:orderId
```

### Cancel Payment
```
POST /payments/cancel/:paymentId
```

## Event Communication

This service communicates with other services through RabbitMQ:

### Events Published
- `payment.created` - When a payment is created
- `PAYMENT_RESULT` - When a payment is completed or failed
- `payment.cancelled` - When a payment is cancelled

### Events Subscribed
- `PAYMENT_REQUEST` - Request to create a payment
- `ORDER_CANCELLED` - When an order is cancelled 
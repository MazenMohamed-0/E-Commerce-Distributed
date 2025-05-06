const orderRepository = require('../repositories/orderRepository');
const Order = require('../models/Order');
const orderEventHandler = require('../events/orderEventHandler');
const winston = require('winston');
const rabbitmq = require('../shared/rabbitmq');
const axios = require('axios');
const emailService = require('./emailService');
require('dotenv').config();

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'order-service.log' })
    ]
});

class OrderService {
    async getAllOrders() {
        try {
            return await orderRepository.findAll();
        } catch (error) {
            throw new Error('Error fetching orders: ' + error.message);
        }
    }

    async getOrdersByUser(userId) {
        try {
            return await orderRepository.findByUser(userId);
        } catch (error) {
            throw new Error('Error fetching user orders: ' + error.message);
        }
    }

    async getOrderById(id) {
        try {
            const order = await orderRepository.findById(id);
            if (!order) {
                throw new Error('Order not found');
            }

            // Return basic order data first and log that we're attempting to enrich with product details
            console.log('Found order:', id, 'Now attempting to enrich with product details');
            
            // Create a copy of the order object to avoid modifying it directly
            const orderWithProducts = { ...order.toObject() };

            try {
                // Attempt to enrich with product details, but don't let it block the response
                // Fetch product details for each item using RabbitMQ
                const productPromises = order.items.map(async (item) => {
                    const plainItem = item.toObject ? item.toObject() : item;
                    try {
                        // Create a unique correlation ID for this request
                        const correlationId = `product-details-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        
                        // Create a promise that will be resolved when we receive the response
                        const responsePromise = new Promise(async (resolve, reject) => {
                            // Set a shorter timeout (3 seconds) to avoid waiting too long
                            const timeoutId = setTimeout(() => {
                                reject(new Error('Product details request timed out'));
                            }, 3000); // 3 second timeout

                            // Create a temporary response queue
                            const queueName = await rabbitmq.createTemporaryResponseQueue(
                                'product-events',
                                correlationId,
                                (message) => {
                                    clearTimeout(timeoutId);
                                    if (message.data.error) {
                                        reject(new Error(message.data.error));
                                    } else {
                                        resolve(message.data);
                                    }
                                }
                            );

                            try {
                                // Publish the product details request
                                await rabbitmq.publish('product-events', 'product.details.request', {
                                    type: 'product.details.request',
                                    correlationId,
                                    data: {
                                        productId: plainItem.productId,
                                        replyTo: `response.${correlationId}`
                                    }
                                });
                            } catch (error) {
                                clearTimeout(timeoutId);
                                reject(error);
                            } finally {
                                // Cleanup function to be called after resolution or rejection
                                setTimeout(async () => {
                                    try {
                                        await rabbitmq.unsubscribe(queueName);
                                    } catch (error) {
                                        console.error('Error cleaning up temporary queue:', error);
                                    }
                                }, 1000); // Give a second for the message to be processed
                            }
                        });

                        // Wait for the response
                        const productDetails = await responsePromise;
                        return {
                            ...plainItem,
                            productDetails
                        };
                    } catch (error) {
                        // Don't let an error fetching product details block the whole request
                        console.error(`Error fetching product ${plainItem.productId}:`, error.message);
                        return {
                            ...plainItem
                        };
                    }
                });

                // Wait for all product details to be fetched with a race against a timeout
                const itemsWithProducts = await Promise.race([
                    Promise.all(productPromises),
                    new Promise(resolve => setTimeout(() => resolve([]), 5000)) // 5 second max wait time for all products
                ]);
                
                if (itemsWithProducts.length > 0) {
                    orderWithProducts.items = itemsWithProducts;
                }
                
                return orderWithProducts;
            } catch (productError) {
                // If there's any error fetching product details, just return the order as is
                console.error('Error enriching order with product details:', productError);
                return orderWithProducts;
            }
        } catch (error) {
            throw new Error('Error fetching order: ' + error.message);
        }
    }

    async createOrder(userId, cartData, userEmail) {
        try {
            // Validate products first
            if (!cartData.items || !Array.isArray(cartData.items)) {
                throw new Error('Invalid order data: items array is required');
            }
            
            // Log the userEmail we received from the token middleware
            console.log(`[ORDER SERVICE] Creating order for user ${userId} with email ${userEmail}`);
            
            // Format items for validation
            const itemsForValidation = cartData.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity
            }));

            console.log('Requesting product validation for items:', itemsForValidation);

            // Simple check for product availability and stock via RabbitMQ
            const validationResult = await orderEventHandler.requestProductValidation(itemsForValidation);
            
            if (!validationResult || !validationResult.isValid) {
                throw new Error('Order validation failed: Products unavailable or insufficient stock');
            }

            // Update cart items with current prices from validation results
            const updatedItems = cartData.items.map(item => {
                const validationItem = validationResult.validationResults
                    .find(v => v.productId === item.productId);
                
                return {
                    productId: item.productId,
                    sellerId: validationItem.productDetails?.sellerId || item.sellerId,
                    quantity: item.quantity,
                    price: validationItem.productDetails?.price || item.price,
                    productName: item.productName,
                    imageUrl: item.imageUrl
                };
            });

            // Calculate total amount
            const totalAmount = updatedItems.reduce((total, item) => total + (item.price * item.quantity), 0);

            // Create order with userEmail field
            const order = new Order({
                userId,
                userEmail, // Store the email from JWT token
                items: updatedItems,
                totalAmount,
                status: 'processing',
                shippingAddress: cartData.shippingAddress,
                paymentMethod: cartData.paymentMethod || 'cash'
            });

            await order.save();
            
            // Send confirmation email - add debug log here
            console.log(`[ORDER SERVICE] About to send order confirmation email for order ${order._id}`);
            await this.sendOrderConfirmationEmail(order);
            
            // Handle payment method-specific logic
            if (order.paymentMethod === 'stripe') {
                // For Stripe payment, create payment intent
                try {
                    const payment = await this.createStripePayment(order);
                    order.payment = payment;
                    await order.save();
                } catch (paymentError) {
                    // Log the error but don't automatically switch to cash payment
                    logger.error('Stripe payment creation failed:', paymentError);
                    
                    // Mark the order as failed
                    order.status = 'failed';
                    order.error = paymentError.message;
                    await order.save();
                    
                    throw paymentError;
                }
            } else if (order.paymentMethod === 'cash') {
                // For cash payment, mark as completed immediately since it's cash on delivery
                
                // Cash on delivery orders should be marked as completed when settled
                order.status = 'completed';
                order.paymentStatus = 'completed';
                await order.save();
                
                // Notify about completed order for inventory update
                await orderEventHandler.publishOrderEvent('ORDER_COMPLETED', {
                    orderId: order._id,
                    userId: order.userId,
                    items: order.items
                });
                
                logger.info(`Cash on delivery order marked as completed: ${order._id}`);
            }
            
            return order;
        } catch (error) {
            logger.error('Error creating order:', error);
            throw error;
        }
    }

    // Helper method to create Stripe payment
    async createStripePayment(order) {
        try {
            // Request Stripe payment via RabbitMQ
            const correlationId = `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            logger.info('Starting Stripe payment creation', {
                orderId: order._id,
                correlationId,
                amount: order.totalAmount
            });
            
            try {
                const paymentResponse = await new Promise(async (resolve, reject) => {
                    const timeoutId = setTimeout(() => {
                        logger.error('Payment request timed out', {
                            orderId: order._id,
                            correlationId
                        });
                        reject(new Error('Payment request timed out'));
                    }, 30000); // Increase from 10000 to 30000 (30 seconds)

                    try {
                        logger.info('Creating temporary response queue', {
                            exchange: 'payment-events',
                            correlationId
                        });
                        
                        const queueName = await rabbitmq.createTemporaryResponseQueue(
                            'payment-events',
                            correlationId,
                            (message) => {
                                logger.info('Received response on temporary queue', {
                                    correlationId,
                                    hasError: !!message.data.error,
                                    hasClientSecret: !!message.data.stripeClientSecret
                                });
                                
                                clearTimeout(timeoutId);
                                if (message.data.error) {
                                    reject(new Error(message.data.error));
                                } else {
                                    resolve(message.data);
                                }
                            }
                        );
                        
                        logger.info('Publishing payment.create.request', {
                            orderId: order._id,
                            correlationId,
                            queueName,
                            replyTo: `response.${correlationId}`
                        });

                        await rabbitmq.publish('payment-events', 'payment.create.request', {
                            type: 'payment.create.request',
                            correlationId,
                            data: {
                                orderId: order._id,
                                userId: order.userId,
                                amount: order.totalAmount,
                                paymentMethod: 'stripe',
                                replyTo: `response.${correlationId}`
                            }
                        });
                        
                        logger.info('Successfully published payment.create.request', {
                            orderId: order._id,
                            correlationId
                        });
                    } catch (error) {
                        logger.error('Error in payment request process', {
                            orderId: order._id,
                            correlationId,
                            error: error.message,
                            stack: error.stack
                        });
                        clearTimeout(timeoutId);
                        reject(error);
                    }
                });
                
                logger.info('Received payment response', {
                    orderId: order._id,
                    hasClientSecret: !!paymentResponse.stripeClientSecret,
                    hasPaymentIntentId: !!paymentResponse.stripePaymentIntentId
                });

                return {
                    status: 'pending',
                    stripeClientSecret: paymentResponse.stripeClientSecret,
                    stripePaymentIntentId: paymentResponse.stripePaymentIntentId
                };
            } catch (mqError) {
                // If RabbitMQ communication fails, try direct HTTP call to payment service
                logger.warn('RabbitMQ communication failed, falling back to direct HTTP call', {
                    orderId: order._id,
                    error: mqError.message
                });
                
                // Get the payment service URL from environment or use default
                const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005';
                
                try {
                    logger.info('Making direct HTTP call to payment service', {
                        url: `${paymentServiceUrl}/payments/test-stripe`,
                        orderId: order._id
                    });
                    
                    const response = await axios.post(
                        `${paymentServiceUrl}/payments/test-stripe`,
                        {
                            orderId: order._id,
                            userId: order.userId,
                            amount: order.totalAmount
                        }
                    );
                    
                    logger.info('Direct HTTP call successful', {
                        orderId: order._id,
                        paymentId: response.data.payment.paymentId,
                        hasClientSecret: !!response.data.payment.stripeClientSecret
                    });
                    
                    return {
                        status: 'pending',
                        stripeClientSecret: response.data.payment.stripeClientSecret,
                        stripePaymentIntentId: response.data.payment.stripePaymentIntentId
                    };
                } catch (httpError) {
                    logger.error('Direct HTTP call to payment service failed', {
                        orderId: order._id,
                        error: httpError.message,
                        response: httpError.response?.data
                    });
                    
                    throw new Error(`Both RabbitMQ and HTTP payment methods failed: ${httpError.message}`);
                }
            }
        } catch (error) {
            logger.error('Error creating Stripe payment:', {
                orderId: order._id,
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to create payment: ${error.message}`);
        }
    }

    async processOrder(orderId) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // Update order status to PROCESSING
            order.status = 'PROCESSING';
            await order.save();

            // Publish ORDER_PROCESSING event
            await orderEventHandler.publishOrderEvent('ORDER_PROCESSING', {
                orderId,
                items: order.items
            });

            logger.info(`Order processing started: ${orderId}`);
            return order;
        } catch (error) {
            logger.error('Error processing order:', error);
            throw error;
        }
    }

    async completeOrder(orderId) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // Update order status to COMPLETED
            order.status = 'COMPLETED';
            order.paymentStatus = 'PAID';
            await order.save();

            // Publish ORDER_COMPLETED event
            await orderEventHandler.publishOrderEvent('ORDER_COMPLETED', {
                orderId,
                userId: order.userId,
                items: order.items
            });

            logger.info(`Order completed: ${orderId}`);
            return order;
        } catch (error) {
            logger.error('Error completing order:', error);
            throw error;
        }
    }

    async cancelOrder(orderId, reason) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // Update order status to CANCELLED
            order.status = 'CANCELLED';
            order.cancellationReason = reason;
            await order.save();

            // Publish ORDER_CANCELLED event
            await orderEventHandler.publishOrderEvent('ORDER_CANCELLED', {
                orderId,
                userId: order.userId,
                items: order.items,
                reason
            });

            logger.info(`Order cancelled: ${orderId}`);
            return order;
        } catch (error) {
            logger.error('Error cancelling order:', error);
            throw error;
        }
    }

    async getOrder(orderId) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }
            return order;
        } catch (error) {
            logger.error('Error getting order:', error);
            throw error;
        }
    }

    async getUserOrders(userId) {
        try {
            return await Order.find({ userId }).sort({ createdAt: -1 });
        } catch (error) {
            logger.error('Error getting user orders:', error);
            throw error;
        }
    }

    async handleStockReserved(orderId) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // Update order status to STOCK_RESERVED
            order.status = 'STOCK_RESERVED';
            await order.save();

            // Publish PAYMENT_REQUESTED event
            await orderEventHandler.publishOrderEvent('PAYMENT_REQUESTED', {
                orderId,
                userId: order.userId,
                amount: order.totalAmount
            });

            logger.info(`Stock reserved for order: ${orderId}`);
            return order;
        } catch (error) {
            logger.error('Error handling stock reservation:', error);
            throw error;
        }
    }

    async handleStockReservationFailed(orderId, reason) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // Update order status to FAILED
            order.status = 'FAILED';
            order.failureReason = reason;
            await order.save();

            // Publish ORDER_FAILED event
            await orderEventHandler.publishOrderEvent('ORDER_FAILED', {
                orderId,
                userId: order.userId,
                reason
            });

            logger.info(`Stock reservation failed for order: ${orderId}`);
            return order;
        } catch (error) {
            logger.error('Error handling stock reservation failure:', error);
            throw error;
        }
    }

    async handlePaymentCompleted(orderId) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // Update order status to completed
            order.status = 'completed';
            await order.save();

            // Publish ORDER_COMPLETED event to trigger stock reduction
            await orderEventHandler.publishOrderEvent('ORDER_COMPLETED', {
                orderId,
                userId: order.userId,
                items: order.items
            });

            logger.info(`Payment completed and order processed for order: ${orderId}`);
            return order;
        } catch (error) {
            logger.error('Error handling payment completion:', error);
            throw error;
        }
    }

    async handlePaymentFailed(orderId, reason) {
        try {
            const order = await Order.findById(orderId);
            if (!order) {
                throw new Error('Order not found');
            }

            // Update order status to failed
            order.status = 'failed';
            order.failureReason = reason || 'Payment failed';
            await order.save();

            // Publish ORDER_FAILED event
            await orderEventHandler.publishOrderEvent('ORDER_FAILED', {
                orderId,
                userId: order.userId,
                reason: reason || 'Payment failed'
            });

            logger.info(`Order failed due to payment failure: ${orderId}`);
            return order;
        } catch (error) {
            logger.error('Error handling payment failure:', error);
            throw error;
        }
    }

    async updateOrderStatus(id, status) {
        try {
            const updatedOrder = await orderRepository.updateStatus(id, status);
            if (!updatedOrder) {
                throw new Error('Order not found');
            }
            return updatedOrder;
        } catch (error) {
            throw new Error('Error updating order status: ' + error.message);
        }
    }

    async updatePaymentStatus(id, paymentStatus) {
        try {
            const updatedOrder = await orderRepository.updatePaymentStatus(id, paymentStatus);
            if (!updatedOrder) {
                throw new Error('Order not found');
            }
            return updatedOrder;
        } catch (error) {
            throw new Error('Error updating payment status: ' + error.message);
        }
    }

    async getOrdersForSeller(sellerId) {
        try {
            // Get all orders that contain any of the seller's products using the repository
            const orders = await orderRepository.findOrdersForProducts(sellerId);
            
            // For each order, filter items to only include those from this seller
            const sellerOrders = orders.map(order => {
                const orderObj = order.toObject();
                
                // Filter items to only include those from this seller
                const sellerItems = orderObj.items.filter(item => 
                    item.sellerId === sellerId
                );
                
                // Calculate the total amount for just this seller's items
                const sellerTotalAmount = sellerItems.reduce(
                    (total, item) => total + (item.price * item.quantity), 
                    0
                );
                
                return {
                    ...orderObj,
                    items: sellerItems,
                    sellerTotalAmount: sellerTotalAmount,
                    // Keep the original totalAmount for reference
                    originalTotalAmount: orderObj.totalAmount
                };
            });
            
            // Only return orders that still have items after filtering
            return sellerOrders.filter(order => order.items.length > 0);
        } catch (error) {
            logger.error('Error in getOrdersForSeller:', error);
            throw error;
        }
    }

    async sendOrderConfirmationEmail(order, userEmail = null) {
        try {
            if (!order) {
                logger.error('Cannot send email confirmation for null order');
                console.error(`[ORDER SERVICE] Cannot send email confirmation for null order`);
                return;
            }
            
            // If userEmail is provided directly, use it
            // Otherwise, we'll use JWT token data which is now passed directly
            const email = userEmail || order.userEmail;
            
            if (!email) {
                logger.error(`Could not determine valid email for order ${order._id}`);
                console.error(`[ORDER SERVICE] Could not determine valid email for order ${order._id}, no email will be sent`);
                return;
            }
            
            // Add console log for debugging
            console.log(`[ORDER SERVICE] ✅ Sending confirmation email for order ${order._id} to ${email}`);
            
            // Prepare the order data for email sending - stringify and parse to ensure it's a plain object
            const orderData = JSON.parse(JSON.stringify(order));
            
            // Create the request payload
            const emailPayload = {
                order: orderData,
                userEmail: email
            };
            
            // Log the full payload for debugging
            console.log(`[ORDER SERVICE] Email payload:`, JSON.stringify(emailPayload));
            
            // Use our email service directly without environment variables
            logger.info(`Sending order confirmation email for order ${order._id} to ${email}`);
            
            try {
                // Check for empty email or invalid format
                if (!email || !email.includes('@')) {
                    console.error(`[ORDER SERVICE] Invalid email format: ${email}`);
                    logger.error(`Invalid email format: ${email}`);
                    return;
                }
                
                // Add debug log to see if we're using the correct Cloud Function URL
                const cloudFunctionUrl = 'https://us-central1-precise-valor-457221-a5.cloudfunctions.net/sendOrderConfirmation';
                console.log(`[ORDER SERVICE] Using email cloud function at: ${cloudFunctionUrl}`);
                
                // Call the Cloud Function directly with axios
                const response = await axios.post(cloudFunctionUrl, emailPayload, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout
                });
                
                if (response.data && response.data.success) {
                    console.log(`[ORDER SERVICE] ✅ Email sent successfully for order ${order._id} to ${email}`);
                    logger.info(`Order confirmation email sent successfully for order ${order._id}`, {
                        messageId: response.data.messageId,
                        recipientEmail: email
                    });
                    return { success: true, messageId: response.data.messageId };
                } else {
                    console.log(`[ORDER SERVICE] ❌ Email sending failed for order ${order._id}: ${response.data?.error || 'Unknown error'}`);
                    logger.error(`Failed to send email for order ${order._id}: ${response.data?.error || 'Unknown error'}`);
                    return { success: false, error: response.data?.error || 'Unknown error' };
                }
            } catch (emailError) {
                console.error(`[ORDER SERVICE] Email service error for order ${order._id}:`, emailError.message);
                logger.error(`Email service error for order ${order._id}:`, {
                    message: emailError.message
                });
                return { success: false, error: emailError.message };
            }
        } catch (error) {
            // Don't fail the order if email fails
            console.error(`[ORDER SERVICE] Failed to send order confirmation email:`, error.message);
            logger.error(`Failed to send order confirmation email for order ${order?._id}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async getUserEmail(userId) {
        try {
            if (!userId) {
                console.error(`[ORDER SERVICE] Cannot get email for null/undefined userId`);
                return null;
            }
            
            // Try to get user email from the Auth service
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
            console.log(`[ORDER SERVICE] Getting user email for userId: ${userId} from ${authServiceUrl}`);
            
            try {
                const response = await axios.get(`${authServiceUrl}/users/profile/${userId}`, {
                    timeout: 5000 // 5 second timeout
                });
                
                if (response.data && response.data.email) {
                    console.log(`[ORDER SERVICE] Successfully retrieved email: ${response.data.email}`);
                    return response.data.email;
                } else {
                    console.log(`[ORDER SERVICE] Auth service response missing email:`, JSON.stringify(response.data));
                    
                    // No valid email in the response
                    if (process.env.NODE_ENV === 'development') {
                        // Only use fallback in development
                        const fallbackEmail = process.env.FALLBACK_TEST_EMAIL || 'test@example.com';
                        console.log(`[ORDER SERVICE] Using development fallback email: ${fallbackEmail}`);
                        return fallbackEmail;
                    } else {
                        console.error(`[ORDER SERVICE] Could not get email for user ${userId} in production mode`);
                        return null; // Return null in production to avoid sending to wrong email
                    }
                }
            } catch (error) {
                console.error(`[ORDER SERVICE] Failed to get user email for userId ${userId}:`, error.message);
                if (error.response) {
                    console.error(`[ORDER SERVICE] Response status: ${error.response.status}`);
                }
                
                // Only use fallback in development mode
                if (process.env.NODE_ENV === 'development') {
                    const fallbackEmail = process.env.FALLBACK_TEST_EMAIL || 'test@example.com';
                    console.log(`[ORDER SERVICE] Using development fallback email after error: ${fallbackEmail}`);
                    return fallbackEmail;
                } else {
                    console.error(`[ORDER SERVICE] Auth service unavailable in production mode`);
                    return null; // Return null in production to avoid sending to wrong email
                }
            }
        } catch (error) {
            console.error(`[ORDER SERVICE] Error in getUserEmail:`, error.message);
            
            // Only use fallback in development mode for unexpected errors
            if (process.env.NODE_ENV === 'development') {
                const fallbackEmail = process.env.FALLBACK_TEST_EMAIL || 'test@example.com';
                console.log(`[ORDER SERVICE] Using development fallback email after unexpected error: ${fallbackEmail}`);
                return fallbackEmail;
            } else {
                console.error(`[ORDER SERVICE] Unexpected error in production mode`);
                return null; // Return null in production to avoid sending to wrong email
            }
        }
    }
}

module.exports = new OrderService();
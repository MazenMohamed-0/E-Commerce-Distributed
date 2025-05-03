const orderRepository = require('../repositories/orderRepository');
const Order = require('../models/Order');
const orderEventHandler = require('../events/orderEventHandler');
const winston = require('winston');
const rabbitmq = require('../../shared/rabbitmq');
const axios = require('axios');

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

    async createOrder(userId, cartData) {
        try {
            // Validate products first
            if (!cartData.items || !Array.isArray(cartData.items)) {
                throw new Error('Invalid order data: items array is required');
            }
            
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
                    productName: item.productName
                };
            });

            // Calculate total amount
            const totalAmount = updatedItems.reduce((total, item) => total + (item.price * item.quantity), 0);

            // Create order
            const order = new Order({
                userId,
                items: updatedItems,
                totalAmount,
                status: 'processing',
                shippingAddress: cartData.shippingAddress,
                paymentMethod: cartData.paymentMethod || 'cash'
            });

            await order.save();
            
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
                    order.error = {
                        message: `Payment creation failed: ${paymentError.message}`,
                        step: 'payment_creation',
                        timestamp: new Date()
                    };
                    await order.save();
                    
                    // Re-throw the error to be handled by the caller
                    throw new Error(`Failed to create payment: ${paymentError.message}`);
                }
            } else if (order.paymentMethod === 'cash') {
                // For cash payment, mark as completed immediately
                order.status = 'completed';
                await order.save();
                
                // Notify product service about the completed order
                await orderEventHandler.publishOrderEvent('ORDER_COMPLETED', {
                    orderId: order._id,
                    userId,
                    items: updatedItems
                });
            }

            logger.info(`Order created: ${order._id}`);
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
}

module.exports = new OrderService();
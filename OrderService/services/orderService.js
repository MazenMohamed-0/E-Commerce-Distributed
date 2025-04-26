const Order = require('../models/Order');
const axios = require('axios');
const emailService = require('./emailService');

class OrderService {
    async getAllOrders() {
        try {
            return await Order.find();
        } catch (error) {
            throw new Error('Error fetching orders: ' + error.message);
        }
    }

    async getOrdersByUser(userId) {
        try {
            return await Order.find({ userId });
        } catch (error) {
            throw new Error('Error fetching user orders: ' + error.message);
        }
    }

    async getOrderById(id) {
        try {
            const order = await Order.findById(id);
            if (!order) {
                throw new Error('Order not found');
            }
            return order;
        } catch (error) {
            throw new Error('Error fetching order: ' + error.message);
        }
    }

    async createOrder(orderData) {
        try {
            // Validate order data
            if (!orderData.items || orderData.items.length === 0) {
                throw new Error('Order must contain at least one item');
            }
            
            // Get the authentication token from the headers
            const token = orderData.token;
            if (!token) {
                throw new Error('Authentication token is required');
            }
            
            // Ensure token is in the correct format
            const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
            
            // Verify product availability in Product Service
            const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
            
            // Check each product's availability
            for (const item of orderData.items) {
                try {
                    // Get current product details
                    const productResponse = await axios.get(
                        `${productServiceUrl}/products/${item.productId}`,
                        {
                            headers: {
                                Authorization: authHeader
                            },
                            timeout: 5000
                        }
                    );
                    
                    const product = productResponse.data;
                    
                    // Check if enough stock is available
                    if (product.stock < item.quantity) {
                        throw new Error(`Not enough stock available for product: ${product.name}`);
                    }
                    
                    // Instead of updating the stock directly (which requires seller/admin permission),
                    // use a dedicated stock update endpoint that's designed for order processing
                    await axios.post(
                        `${productServiceUrl}/products/${item.productId}/reduce-stock`,
                        { 
                            quantity: item.quantity,
                            orderId: orderData.orderId || 'pending' // Include order reference
                        },
                        {
                            headers: {
                                Authorization: authHeader,
                                'X-Service-Type': 'order-service' // Identify this as a service-to-service call
                            },
                            timeout: 5000
                        }
                    );
                    
                    console.log(`Requested stock reduction for product ${item.productId} by ${item.quantity} units`);
                    
                } catch (error) {
                    console.error('Error processing product:', error.message);
                    if (error.response) {
                        console.error('Status:', error.response.status);
                        console.error('Data:', error.response.data);
                    }
                    throw new Error(`Failed to process product ${item.productId}: ${error.message}`);
                }
            }
            
            // Remove the token from the order data before saving
            const { token: _, ...orderDataToSave } = orderData;
            
            // Create and save the order
            const order = new Order(orderDataToSave);
            const savedOrder = await order.save();
            
            // Clear the user's cart
            try {
                const cartServiceUrl = process.env.CART_SERVICE_URL || 'http://localhost:3003';
                await axios.delete(
                    `${cartServiceUrl}/cart`,
                    {
                        headers: {
                            Authorization: authHeader
                        },
                        timeout: 5000
                    }
                );
                console.log(`Cleared cart for user ${orderData.userId}`);
            } catch (cartError) {
                // Don't fail the order if cart clearing fails
                console.error('Error clearing user cart:', cartError.message);
            }
            
            // Get user email from Auth Service
            try {
                const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
                const userResponse = await axios.get(
                    `${authServiceUrl}/users/${orderData.userId}`,
                    {
                        headers: {
                            Authorization: authHeader
                        },
                        timeout: 5000
                    }
                );
                
                if (userResponse.data && userResponse.data.email) {
                    // Send order confirmation email
                    const emailResult = await emailService.sendOrderConfirmation(
                        savedOrder, 
                        userResponse.data.email
                    );
                    
                    if (emailResult.success) {
                        console.log(`Order confirmation email sent to ${userResponse.data.email}`);
                        if (emailResult.previewUrl) {
                            console.log(`Email preview URL: ${emailResult.previewUrl}`);
                        }
                    } else {
                        console.error('Failed to send order confirmation email:', emailResult.error);
                    }
                } else {
                    console.error('User email not found in Auth Service response');
                }
            } catch (emailError) {
                // Don't fail the order if email sending fails
                console.error('Error sending order confirmation email:', emailError.message);
            }
            
            return savedOrder;
        } catch (error) {
            console.error('Error creating order:', error);
            throw new Error('Error creating order: ' + error.message);
        }
    }

    async updateOrderStatus(id, status) {
        try {
            const order = await Order.findById(id);
            if (!order) {
                throw new Error('Order not found');
            }
            order.status = status;
            order.updatedAt = Date.now();
            return await order.save();
        } catch (error) {
            throw new Error('Error updating order status: ' + error.message);
        }
    }

    async updatePaymentStatus(id, paymentStatus) {
        try {
            const order = await Order.findById(id);
            if (!order) {
                throw new Error('Order not found');
            }
            order.paymentStatus = paymentStatus;
            order.updatedAt = Date.now();
            return await order.save();
        } catch (error) {
            throw new Error('Error updating payment status: ' + error.message);
        }
    }

    async getOrdersForSeller(sellerId, token) {
        try {
            // First, get all products created by this seller from the Product Service
            const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
            
            // Add timeout to prevent hanging requests
            let sellerProducts = [];
            try {
                console.log('Fetching products for seller:', sellerId);
                console.log('Using token:', token ? 'Token provided' : 'No token provided');
                
                // Ensure the token is in the correct format - the Product Service expects "Bearer token"
                // but our middleware extracts just the token part, so we need to add "Bearer " back
                const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
                
                console.log('Making request to:', `${productServiceUrl}/products/seller/${sellerId}`);
                const productsResponse = await axios.get(
                    `${productServiceUrl}/products`, 
                    {
                        headers: {
                            Authorization: authHeader
                        },
                        timeout: 5000 // 5 second timeout
                    }
                );
                
                console.log('Product Service response received');
                // Filter products by seller ID since we're getting all products
                sellerProducts = productsResponse.data.filter(product => 
                    product.createdBy && product.createdBy._id === sellerId
                );
                console.log(`Found ${sellerProducts.length} products for seller ${sellerId}`);
            } catch (apiError) {
                console.error('Error fetching products from Product Service:', apiError.message);
                if (apiError.response) {
                    console.error('Status:', apiError.response.status);
                    console.error('Data:', apiError.response.data);
                } else if (apiError.request) {
                    console.error('No response received');
                } else {
                    console.error('Unknown error:', apiError);
                }
                // If the endpoint doesn't exist or times out, we'll continue with an empty products array
                // This prevents the request from hanging indefinitely
            }
            
            if (!sellerProducts || sellerProducts.length === 0) {
                console.log('No products found for seller, returning empty orders array');
                return [];
            }
            
            // Get product IDs created by this seller
            const sellerProductIds = sellerProducts.map(product => product._id);
            console.log('Seller product IDs:', sellerProductIds);
            
            // Find all orders that contain any of the seller's products
            const orders = await Order.find({
                'items.productId': { $in: sellerProductIds }
            });
            console.log(`Found ${orders.length} orders containing seller products`);
            
            // For each order, filter items to only include those from this seller
            const sellerOrders = orders.map(order => {
                const orderObj = order.toObject();
                
                // Filter items to only include those from this seller
                const sellerItems = orderObj.items.filter(item => 
                    sellerProductIds.includes(item.productId.toString())
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
            console.error('Error in getOrdersForSeller:', error);
            // Return empty array instead of throwing to prevent request hanging
            return [];
        }
    }
}

module.exports = new OrderService();
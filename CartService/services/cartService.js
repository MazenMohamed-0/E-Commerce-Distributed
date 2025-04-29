const cartRepository = require('../repositories/cartRepository');
const axios = require('axios');

class CartService {
    async getCart(userId) {
        try {
            let cart = await cartRepository.findByUser(userId);
            if (!cart) {
                // Create a new cart if one doesn't exist
                const cartData = {
                    userId,
                    items: [],
                    totalAmount: 0
                };
                cart = await cartRepository.create(cartData);
            }
            
            return cart;
        } catch (error) {
            throw new Error('Error fetching cart: ' + error.message);
        }
    }

    async addToCart(userId, item, token) {
        try {
            // Verify product exists and get details from Product Service
            const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
            const productResponse = await axios.get(`${productServiceUrl}/products/${item.productId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const product = productResponse.data;

            if (!product) {
                throw new Error('Product not found');
            }

            if (!product.createdBy) {
                throw new Error('Product seller information not found');
            }
            
            // Create a cart item with product details
            const cartItem = {
                productId: item.productId,
                quantity: item.quantity,
                price: product.price,
                name: product.name,
                imageUrl: product.imageUrl,
                stock: product.stock,
                seller: {
                    _id: product.createdBy._id,
                    name: product.createdBy.name,
                    storeName: product.createdBy.storeName,
                    role: product.createdBy.role
                }
            };
            
            // Use the repository to add the item to the cart
            // This handles checking for existing items and stock validation
            const updatedCart = await cartRepository.addItem(userId, cartItem);
            return updatedCart;
        } catch (error) {
            throw new Error('Error adding item to cart: ' + error.message);
        }
    }

    async updateCartItem(userId, productId, quantity, token) {
        try {
            // Check if the cart exists
            const cart = await cartRepository.findByUser(userId);
            if (!cart) {
                throw new Error('Cart not found');
            }
            
            // Find the item in the cart
            const itemIndex = cart.items.findIndex(
                item => item.productId.toString() === productId
            );
            
            if (itemIndex === -1) {
                throw new Error('Item not found in cart');
            }
            
            if (quantity <= 0) {
                // Remove item if quantity is 0 or negative
                return await cartRepository.removeItem(userId, productId);
            } else {
                // Always check product stock regardless of whether increasing or decreasing
                const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
                const productResponse = await axios.get(`${productServiceUrl}/products/${productId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const product = productResponse.data;
                
                // Check if requested quantity exceeds available stock
                if (product.stock < quantity) {
                    throw new Error(`Not enough stock available. Only ${product.stock} items in stock, but ${quantity} requested.`);
                }
                
                // Use the repository to update the cart item
                return await cartRepository.updateItem(userId, productId, quantity);
            }
        } catch (error) {
            throw new Error('Error updating cart item: ' + error.message);
        }
    }

    async removeFromCart(userId, productId) {
        try {
            // Check if the cart exists
            const cart = await cartRepository.findByUser(userId);
            if (!cart) {
                throw new Error('Cart not found');
            }
            
            // Find the item in the cart
            const itemIndex = cart.items.findIndex(
                item => item.productId.toString() === productId
            );
            
            if (itemIndex === -1) {
                throw new Error('Item not found in cart');
            }
            
            // Use the repository to remove the item
            return await cartRepository.removeItem(userId, productId);
        } catch (error) {
            throw new Error('Error removing item from cart: ' + error.message);
        }
    }

    async clearCart(userId) {
        try {
            // Check if the cart exists
            const cart = await cartRepository.findByUser(userId);
            if (!cart) {
                throw new Error('Cart not found');
            }
            
            // Use the repository to clear the cart
            await cartRepository.clearCart(userId);
            return { message: 'Cart cleared successfully' };
        } catch (error) {
            throw new Error('Error clearing cart: ' + error.message);
        }
    }
}

module.exports = new CartService();

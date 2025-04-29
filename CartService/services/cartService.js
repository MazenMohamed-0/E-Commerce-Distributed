const Cart = require('../models/Cart');
const axios = require('axios');

class CartService {
    async getCart(userId) {
        try {
            let cart = await Cart.findOne({ userId });
            if (!cart) {
                // Create a new cart if one doesn't exist
                cart = new Cart({
                    userId,
                    items: [],
                    totalAmount: 0
                });
                await cart.save();
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
            
            let cart = await Cart.findOne({ userId });
            if (!cart) {
                // Create a new cart if one doesn't exist
                cart = new Cart({
                    userId,
                    items: [],
                    totalAmount: 0
                });
            }
            
            // Check if product already exists in cart
            const existingItemIndex = cart.items.findIndex(
                cartItem => cartItem.productId.toString() === item.productId
            );
            
            // Calculate total requested quantity (existing + new)
            let totalRequestedQuantity = item.quantity;
            if (existingItemIndex > -1) {
                totalRequestedQuantity += cart.items[existingItemIndex].quantity;
            }
            
            // Check if there's enough stock for the total requested quantity
            if (product.stock < totalRequestedQuantity) {
                throw new Error(`Not enough stock available. Only ${product.stock} items in stock, but ${totalRequestedQuantity} requested.`);
            }
            
            if (existingItemIndex > -1) {
                // Update existing item quantity
                cart.items[existingItemIndex].quantity += item.quantity;
            } else {
                // Add new item to cart with seller information
                cart.items.push({
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
                });
            }
            
            // Recalculate total amount
            cart.totalAmount = cart.items.reduce(
                (total, item) => total + (item.price * item.quantity), 0
            );
            
            cart.updatedAt = Date.now();
            await cart.save();
            return cart;
        } catch (error) {
            throw new Error('Error adding item to cart: ' + error.message);
        }
    }

    async updateCartItem(userId, productId, quantity, token) {
        try {
            const cart = await Cart.findOne({ userId });
            
            if (!cart) {
                throw new Error('Cart not found');
            }
            
            const itemIndex = cart.items.findIndex(
                item => item.productId.toString() === productId
            );
            
            if (itemIndex === -1) {
                throw new Error('Item not found in cart');
            }
            
            if (quantity <= 0) {
                // Remove item if quantity is 0 or negative
                cart.items.splice(itemIndex, 1);
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
                
                // Update quantity and ensure seller info is present
                cart.items[itemIndex].quantity = quantity;
                if (product.createdBy && !cart.items[itemIndex].seller) {
                    cart.items[itemIndex].seller = {
                        _id: product.createdBy._id,
                        name: product.createdBy.name,
                        storeName: product.createdBy.storeName,
                        role: product.createdBy.role
                    };
                }
            }
            
            // Recalculate total amount
            cart.totalAmount = cart.items.reduce(
                (total, item) => total + (item.price * item.quantity), 0
            );
            
            cart.updatedAt = Date.now();
            await cart.save();
            return cart;
        } catch (error) {
            throw new Error('Error updating cart item: ' + error.message);
        }
    }

    async removeFromCart(userId, productId) {
        try {
            const cart = await Cart.findOne({ userId });
            
            if (!cart) {
                throw new Error('Cart not found');
            }
            
            const itemIndex = cart.items.findIndex(
                item => item.productId.toString() === productId
            );
            
            if (itemIndex === -1) {
                throw new Error('Item not found in cart');
            }
            
            // Remove item from cart
            cart.items.splice(itemIndex, 1);
            
            // Recalculate total amount
            cart.totalAmount = cart.items.reduce(
                (total, item) => total + (item.price * item.quantity), 0
            );
            
            cart.updatedAt = Date.now();
            await cart.save();
            return cart;
        } catch (error) {
            throw new Error('Error removing item from cart: ' + error.message);
        }
    }

    async clearCart(userId) {
        try {
            const cart = await Cart.findOne({ userId });
            
            if (!cart) {
                throw new Error('Cart not found');
            }
            
            cart.items = [];
            cart.totalAmount = 0;
            cart.updatedAt = Date.now();
            
            await cart.save();
            return { message: 'Cart cleared successfully' };
        } catch (error) {
            throw new Error('Error clearing cart: ' + error.message);
        }
    }
}

module.exports = new CartService();

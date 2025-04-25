const Product = require('../models/Product');
const axios = require('axios');

// Mock user service for when Auth Service is unavailable
const mockUserService = {
    getUserById: (userId) => {
        return {
            _id: userId,
            name: 'Store ' + userId.toString().substr(-4),
            email: `store${userId.toString().substr(-4)}@example.com`,
            storeName: 'Store ' + userId.toString().substr(-4),
            role: 'seller'
        };
    },
    
    getUsersByIds: (userIds) => {
        return userIds.map(userId => ({
            _id: userId,
            name: 'Store ' + userId.toString().substr(-4),
            email: `store${userId.toString().substr(-4)}@example.com`,
            storeName: 'Store ' + userId.toString().substr(-4),
            role: 'seller'
        }));
    }
};

class ProductService {
    async getAllProducts() {
        try {
            // Get all products
            const products = await Product.find();
            
            // Get unique user IDs from products (filtering out undefined values)
            const userIds = [...new Set(products.map(product => product.createdBy).filter(id => id))];
            
            // If there are no valid user IDs, just return the products as is
            if (userIds.length === 0) {
                console.log('No valid createdBy fields found in products');
                return products;
            }
            
            // Fetch user information from Auth Service
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';
            let usersMap = {};
            
            try {
                // Call to the Auth Service to get user information using the batch endpoint
                const response = await axios.get(`${authServiceUrl}/auth/users/batch?ids=${userIds.join(',')}`, {
                    timeout: 3000 // 3 second timeout to fail fast if Auth Service is unavailable
                });
                
                // Create a map of user IDs to user objects
                usersMap = response.data.reduce((map, user) => {
                    map[user._id] = user;
                    return map;
                }, {});
                
                console.log('Successfully fetched user data from Auth Service');
            } catch (authError) {
                console.error('Error fetching user information:', authError.message);
                console.log('Using mock user service as fallback');
                
                // Use the mock user service as fallback
                const mockUsers = mockUserService.getUsersByIds(userIds);
                mockUsers.forEach(user => {
                    usersMap[user._id] = user;
                });
            }
            
            // Merge product and user information
            return products.map(product => {
                const productObj = product.toObject();
                if (productObj.createdBy && usersMap[productObj.createdBy]) {
                    productObj.createdBy = {
                        _id: productObj.createdBy,
                        ...usersMap[productObj.createdBy]
                    };
                } else if (!productObj.createdBy) {
                    // Add a placeholder for products without createdBy
                    productObj.createdBy = {
                        _id: null,
                        name: 'Unknown',
                        storeName: 'Unknown Store'
                    };
                }
                return productObj;
            });
        } catch (error) {
            throw new Error('Error fetching products: ' + error.message);
        }
    }

    async getProductById(id) {
        try {
            // Get the product
            const product = await Product.findById(id);
            if (!product) {
                throw new Error('Product not found');
            }
            
            // Fetch user information from Auth Service if createdBy exists
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';
            const productObj = product.toObject();
            
            if (productObj.createdBy) {
                try {
                    // Call to the Auth Service to get user information
                    const response = await axios.get(`${authServiceUrl}/auth/users/${productObj.createdBy}`, {
                        timeout: 3000 // 3 second timeout to fail fast if Auth Service is unavailable
                    });
                    
                    // Merge product and user information
                    productObj.createdBy = {
                        _id: productObj.createdBy,
                        ...response.data
                    };
                    
                    console.log('Successfully fetched user data from Auth Service');
                } catch (authError) {
                    console.error('Error fetching user information:', authError.message);
                    console.log('Using mock user service as fallback');
                    
                    // Use the mock user service as fallback
                    const mockUser = mockUserService.getUserById(productObj.createdBy);
                    productObj.createdBy = mockUser;
                }
            } else {
                // Add a placeholder for products without createdBy
                productObj.createdBy = {
                    _id: null,
                    name: 'Unknown',
                    storeName: 'Unknown Store'
                };
            }
            
            return productObj;
        } catch (error) {
            throw new Error('Error fetching product: ' + error.message);
        }
    }

    async createProduct(productData) {
        try {
            const product = new Product(productData);
            return await product.save();
        } catch (error) {
            throw new Error('Error creating product: ' + error.message);
        }
    }

    async updateProduct(id, productData) {
        try {
            const product = await Product.findById(id);
            if (!product) {
                throw new Error('Product not found');
            }
            Object.assign(product, productData);
            product.updatedAt = Date.now();
            return await product.save();
        } catch (error) {
            throw new Error('Error updating product: ' + error.message);
        }
    }

    async deleteProduct(id) {
        try {
            const product = await Product.findById(id);
            if (!product) {
                throw new Error('Product not found');
            }
            await product.deleteOne();
            return { message: 'Product deleted successfully' };
        } catch (error) {
            throw new Error('Error deleting product: ' + error.message);
        }
    }
}

module.exports = new ProductService(); 
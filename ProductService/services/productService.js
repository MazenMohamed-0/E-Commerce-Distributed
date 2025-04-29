const productRepository = require('../repositories/productRepository');
const axios = require('axios');

class ProductService {
    async getAllProducts() {
        try {
            // Get all products using the repository
            const products = await productRepository.findAll();
            
            // Get unique user IDs from products (filtering out undefined values)
            const userIds = [...new Set(products.map(product => product.createdBy).filter(id => id))];
            
            // If there are no valid user IDs, just return the products as is
            if (userIds.length === 0) {
                return products;
            }
            
            // Fetch user information from Auth Service
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
            let usersMap = {};
            
            try {
                // Call to the Auth Service to get seller store information
                const response = await axios.get(`${authServiceUrl}/users/sellers/batch?ids=${userIds.join(',')}`, {
                    timeout: 5000 // 5 second timeout
                });
                
                if (response.data && Array.isArray(response.data)) {
                    // Create a map of user IDs to store information
                    usersMap = response.data.reduce((map, seller) => {
                        map[seller._id] = {
                            _id: seller._id,
                            name: seller.name,
                            storeName: seller.storeName || 'Unknown Store',
                            role: 'seller'
                        };
                        return map;
                    }, {});
                } else {
                    console.error('Invalid response format from Auth Service:', response.data);
                }
            } catch (authError) {
                console.error('Error fetching seller store information:', authError.message);
                if (authError.response) {
                    console.error('Auth Service response status:', authError.response.status);
                    console.error('Auth Service response data:', authError.response.data);
                }
            }
            
            // Merge product and user information
            const finalProducts = products.map(product => {
                const productObj = product.toObject();
                
                if (productObj.createdBy && usersMap[productObj.createdBy]) {
                    productObj.createdBy = usersMap[productObj.createdBy];
                } else {
                    productObj.createdBy = {
                        _id: productObj.createdBy || null,
                        name: 'Unknown',
                        storeName: 'Unknown Store',
                        role: 'unknown'
                    };
                }
                return productObj;
            });
            return finalProducts;
        } catch (error) {
            console.error('Error in getAllProducts:', error);
            throw new Error('Error fetching products: ' + error.message);
        }
    }

    async getProductById(id) {
        try {
            // Get the product using the repository
            const product = await productRepository.findById(id);
            if (!product) {
                throw new Error('Product not found');
            }
            
            // Fetch user information from Auth Service if createdBy exists
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
            const productObj = product.toObject();
            
            if (productObj.createdBy) {
                try {
                    // Call to the Auth Service to get seller store information
                    const response = await axios.get(`${authServiceUrl}/users/seller/${productObj.createdBy}/store`, {
                        timeout: 5000 // 5 second timeout
                    });
                    
                    if (response.data) {
                    // Merge product and user information
                        productObj.createdBy = {
                            _id: productObj.createdBy,
                            name: response.data.name,
                            storeName: response.data.storeName,
                            role: 'seller'
                        };
                    } else {
                        console.error('Invalid response format from Auth Service');
                        productObj.createdBy = {
                            _id: productObj.createdBy,
                            name: 'Unknown',
                            storeName: 'Unknown Store',
                            role: 'unknown'
                        };
                    }
                } catch (authError) {
                    console.error('Error fetching seller store information:', authError.message);
                    if (authError.response) {
                        console.error('Auth Service response status:', authError.response.status);
                        console.error('Auth Service response data:', authError.response.data);
                    }
                    productObj.createdBy = {
                        _id: productObj.createdBy,
                        name: 'Unknown',
                        storeName: 'Unknown Store',
                        role: 'unknown'
                    };
                }
            } else {
                // Add a placeholder for products without createdBy
                productObj.createdBy = {
                    _id: null,
                    name: 'Unknown',
                    storeName: 'Unknown Store',
                    role: 'unknown'
                };
            }
            
            return productObj;
        } catch (error) {
            console.error('Error in getProductById:', error);
            throw new Error('Error fetching product: ' + error.message);
        }
    }

    async createProduct(productData) {
        try {
            return await productRepository.create(productData);
        } catch (error) {
            throw new Error('Error creating product: ' + error.message);
        }
    }

    async updateProduct(id, productData) {
        try {
            // Add updatedAt timestamp
            productData.updatedAt = Date.now();
            const updatedProduct = await productRepository.update(id, productData);
            if (!updatedProduct) {
                throw new Error('Product not found');
            }
            return updatedProduct;
        } catch (error) {
            throw new Error('Error updating product: ' + error.message);
        }
    }

    async deleteProduct(id) {
        try {
            const result = await productRepository.delete(id);
            if (!result || result.deletedCount === 0) {
                throw new Error('Product not found');
            }
            return { message: 'Product deleted successfully' };
        } catch (error) {
            throw new Error('Error deleting product: ' + error.message);
        }
    }

    async getProductsBySeller(userId) {
        try {
            // Find all products created by this seller using the repository
            const products = await productRepository.findBySeller(userId);
            console.log(`Found ${products.length} products for seller ${userId}`);
            
            return products;
        } catch (error) {
            console.error('Error in getProductsBySeller:', error);
            throw new Error('Error fetching seller products: ' + error.message);
        }
    }

    async reduceProductStock(productId, quantity, orderId) {
        try {
            // Find the product using the repository
            const product = await productRepository.findById(productId);
            if (!product) {
                throw new Error('Product not found');
            }
            
            // Check if enough stock is available
            if (product.stock < quantity) {
                throw new Error(`Not enough stock available. Requested: ${quantity}, Available: ${product.stock}`);
            }
            
            // Calculate the new stock level
            const previousStock = product.stock;
            const newStock = previousStock - quantity;
            
            // Update the stock using the repository
            const updatedProduct = await productRepository.updateStock(productId, newStock);
            
            console.log(`Reduced stock for product ${productId} from ${previousStock} to ${newStock} for order ${orderId}`);
            
            return { 
                message: 'Stock updated successfully', 
                productId, 
                previousStock,
                newStock,
                orderId 
            };
        } catch (error) {
            console.error('Error reducing product stock:', error);
            throw new Error('Error reducing product stock: ' + error.message);
        }
    }
}

module.exports = new ProductService();
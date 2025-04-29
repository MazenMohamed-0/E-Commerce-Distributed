const Product = require('../models/Product');
const axios = require('axios');



class ProductService {
    async getAllProducts() {
        try {
            // Get all products
            const products = await Product.find();
            console.log('Found products:', products.map(p => ({ id: p._id, createdBy: p.createdBy })));
            
            // Get unique user IDs from products (filtering out undefined values)
            const userIds = [...new Set(products.map(product => product.createdBy).filter(id => id))];
            console.log('Unique user IDs to fetch:', userIds);
            
            // If there are no valid user IDs, just return the products as is
            if (userIds.length === 0) {
                console.log('No valid createdBy fields found in products');
                return products;
            }
            
            // Fetch user information from Auth Service
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
            let usersMap = {};
            
            try {
                console.log('Attempting to fetch seller store data from:', `${authServiceUrl}/users/sellers/batch?ids=${userIds.join(',')}`);
                // Call to the Auth Service to get seller store information
                const response = await axios.get(`${authServiceUrl}/users/sellers/batch?ids=${userIds.join(',')}`, {
                    timeout: 5000 // 5 second timeout
                });
                
                console.log('Raw Auth Service response:', response.data);
                
                if (response.data && Array.isArray(response.data)) {
                    // Create a map of user IDs to store information
                    usersMap = response.data.reduce((map, seller) => {
                        console.log('Processing seller:', seller);
                        map[seller._id] = {
                            _id: seller._id,
                            name: seller.name,
                            storeName: seller.storeName || 'Unknown Store',
                            role: 'seller'
                        };
                    return map;
                }, {});
                
                    console.log('Final users map:', usersMap);
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
                console.log('Processing product:', productObj._id, 'createdBy:', productObj.createdBy);
                
                if (productObj.createdBy && usersMap[productObj.createdBy]) {
                    console.log('Found store info for product:', productObj._id, 'store:', usersMap[productObj.createdBy]);
                    productObj.createdBy = usersMap[productObj.createdBy];
                } else {
                    console.log('No store info found for product:', productObj._id, 'using default values');
                    productObj.createdBy = {
                        _id: productObj.createdBy || null,
                        name: 'Unknown',
                        storeName: 'Unknown Store',
                        role: 'unknown'
                    };
                }
                return productObj;
            });

            console.log('Final products with store info:', finalProducts);
            return finalProducts;
        } catch (error) {
            console.error('Error in getAllProducts:', error);
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
            
            console.log('Found product:', { id: product._id, createdBy: product.createdBy });
            
            // Fetch user information from Auth Service if createdBy exists
            const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
            const productObj = product.toObject();
            
            if (productObj.createdBy) {
                try {
                    console.log('Attempting to fetch seller store data from:', `${authServiceUrl}/users/seller/${productObj.createdBy}/store`);
                    // Call to the Auth Service to get seller store information
                    const response = await axios.get(`${authServiceUrl}/users/seller/${productObj.createdBy}/store`, {
                        timeout: 5000 // 5 second timeout
                    });
                    
                    console.log('Raw Auth Service response:', response.data);
                    
                    if (response.data) {
                    // Merge product and user information
                        productObj.createdBy = {
                            _id: productObj.createdBy,
                            name: response.data.name,
                            storeName: response.data.storeName,
                            role: 'seller'
                        };
                        
                        console.log('Updated product with store info:', productObj);
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

    async getProductsBySeller(userId) {
        try {
            // Find all products created by this seller
            const products = await Product.find({ createdBy: userId });
            console.log(`Found ${products.length} products for seller ${userId}`);
            
            return products;
        } catch (error) {
            console.error('Error in getProductsBySeller:', error);
            throw new Error('Error fetching seller products: ' + error.message);
        }
    }

    async reduceProductStock(productId, quantity, orderId) {
        try {
            // Find the product
            const product = await Product.findById(productId);
            if (!product) {
                throw new Error('Product not found');
            }
            
            // Check if enough stock is available
            if (product.stock < quantity) {
                throw new Error(`Not enough stock available. Requested: ${quantity}, Available: ${product.stock}`);
            }
            
            // Reduce the stock
            const newStock = product.stock - quantity;
            product.stock = newStock;
            product.updatedAt = Date.now();
            
            // Save the updated product
            await product.save();
            
            console.log(`Reduced stock for product ${productId} from ${product.stock + quantity} to ${newStock} for order ${orderId}`);
            
            return { 
                message: 'Stock updated successfully', 
                productId, 
                previousStock: product.stock + quantity,
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
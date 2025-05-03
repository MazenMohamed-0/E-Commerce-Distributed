import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import config from '../config';
import { Snackbar, Alert } from '@mui/material';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const CART_SERVICE_URL = config.CART_SERVICE_URL;
  const PRODUCT_SERVICE_URL = config.PRODUCT_SERVICE_URL;

  // Load cart items from localStorage on initial render
  useEffect(() => {
    try {
      const localCart = JSON.parse(localStorage.getItem('cart')) || [];
      setCartItems(Array.isArray(localCart) ? localCart : []);
      // Calculate initial total for local cart
      const initialTotal = localCart.reduce((total, item) => total + (item.price * item.quantity), 0);
      setTotalAmount(initialTotal);
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      setCartItems([]);
      setTotalAmount(0);
    }
  }, []);

  // Sync local cart to service when user logs in
  useEffect(() => {
    if (user && user.role === 'buyer') {
      syncLocalCartToService();
    }
  }, [user]);

  // Add a useEffect hook to fetch cart items when the user is authenticated
  // Place this after the sync effect
  useEffect(() => {
    // Fetch cart data when user logs in or the component mounts with a logged-in user
    if (user && user.role === 'buyer') {
      console.log('User is authenticated, fetching cart items directly');
      fetchCartItems()
        .then(cartData => {
          if (cartData && cartData.items && cartData.items.length > 0) {
            console.log('Fetched cart items from server:', cartData.items.length);
          } else {
            console.log('No cart items found on server');
          }
        })
        .catch(err => {
          console.error('Error fetching initial cart items:', err);
        });
    }
  }, [user]);  // Re-run this effect when the user changes (login/logout)

  const syncLocalCartToService = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      // Prevent multiple syncs
      if (localStorage.getItem('isSyncing')) {
        console.log('Sync already in progress, skipping...');
        return;
      }
      
      localStorage.setItem('isSyncing', 'true');

      try {
        // First, fetch the user's cart from the database
        const response = await axios.get(`${CART_SERVICE_URL}/cart`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const serverCart = response.data;
        console.log('Server cart:', serverCart);
        
        // Get local storage cart
        const localCart = JSON.parse(localStorage.getItem('cart')) || [];
        console.log('Local cart:', localCart);
        
        if (Array.isArray(localCart) && localCart.length > 0) {
          // Only proceed if server cart is empty
          if (!serverCart || !serverCart.items || serverCart.items.length === 0) {
            console.log('Server cart is empty, syncing local cart...');
            
            // Process each item only once
            const processedItems = new Set();
            
            for (const item of localCart) {
              if (!item.productId) {
                console.warn('Skipping item with missing productId:', item);
                continue;
              }

              const productId = item.productId.toString();
              
              // Skip if we've already processed this product
              if (processedItems.has(productId)) {
                console.log('Skipping duplicate product:', productId);
                continue;
              }
              
              processedItems.add(productId);

              try {
                console.log('Adding item to server:', { 
                  productId, 
                  quantity: item.quantity,
                  sellerId: item.sellerId || item.createdBy // Include seller ID
                });
                await axios.post(
                  `${CART_SERVICE_URL}/cart`,
                  { 
                    productId: productId,
                    quantity: parseInt(item.quantity),
                    sellerId: item.sellerId || item.createdBy // Add sellerId to request
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
              } catch (error) {
                console.error('Error adding item to server cart:', error);
                continue;
              }
            }
          } else {
            console.log('Server cart exists with items, ignoring local storage cart');
          }
          
          // Clear local storage after sync attempt
          localStorage.removeItem('cart');
        }
        
        // Fetch and update the final cart state
        await fetchCartItems();
      } finally {
        // Always clear the sync flag
        localStorage.removeItem('isSyncing');
      }
    } catch (error) {
      console.error('Error syncing cart:', error);
      localStorage.removeItem('isSyncing');
    }
  };

  const fetchCartItems = async () => {
    if (user && user.role === 'buyer') {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          return null;
        }

        const response = await axios.get(`${CART_SERVICE_URL}/cart`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data) {
          // Check if the cart is in the response data structure
          const cartData = response.data.cart || response.data;
          
          // Check if we have items in the cart
          const items = cartData.items || [];
          setCartItems(Array.isArray(items) ? items : []);
          setTotalAmount(cartData.totalAmount || 0);
          
          // Return the processed cart data for additional checks
          return {
            ...cartData,
            items: items
          };
        }
        return null;
      } catch (error) {
        console.error('Error fetching cart items:', error);
        setCartItems([]);
        setTotalAmount(0);
        return null;
      }
    }
    return null;
  };

  const addToCartService = async (product, quantity = 1) => {
    try {
      console.log('addToCartService called with:', { product, quantity });
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      if (!user || user.role !== 'buyer') {
        throw new Error('Only buyers can add items to cart');
      }

      if (!product || !product._id) {
        throw new Error('Product ID is required');
      }

      if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      // Check if the product is already in the cart
      const existingItem = cartItems.find(item => item.productId === product._id);
      const totalQuantity = (existingItem?.quantity || 0) + quantity;
      console.log('totalQuantity', totalQuantity);
      console.log('product.stock', product.stock);
      // Validate against product stock
      if (totalQuantity > product.stock) {
        throw new Error(`Cannot add ${quantity} items. Only ${product.stock} available in stock.`);
      }

      const response = await axios.post(
        `${CART_SERVICE_URL}/cart`,
        { 
          productId: product._id.toString(), 
          quantity: parseInt(quantity),
          sellerId: product.createdBy || product.sellerId // Add seller ID to the request
        },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.success) {
        
        // Refresh cart items
        const updatedCart = await axios.get(
          `${CART_SERVICE_URL}/cart`,
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (updatedCart.data) {
          const cartData = updatedCart.data.cart || updatedCart.data;
          const items = cartData.items || [];
          setCartItems(Array.isArray(items) ? items : []);
          setTotalAmount(cartData.totalAmount || 0);
        }
      } else {
        throw new Error('Invalid response from cart service');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  };

  const handleCloseError = () => {
    setError(null);
  };

  const showStockError = (available) => {
    setError({
      severity: 'warning',
      message: `Limited Stock Available: Only ${available} items in stock. You cannot add more than ${available} items.`
    });
  };

  const addToCart = async (product, quantity = 1) => {
    if (user && user.role === 'buyer') {
      // Authenticated user - use cart service
      try {
        await addToCartService(product, quantity);
      } catch (error) {
        if (error.message.includes('available in stock')) {
          showStockError(product.stock);
        } else {
          setError({
            severity: 'error',
            message: error.message
          });
        }
      }
    } else {
      // Unauthenticated user - use localStorage
      try {
        console.log('Local addToCart called with:', { product, quantity });
        
        const localCart = JSON.parse(localStorage.getItem('cart')) || [];
        const existingItem = localCart.find(item => item.productId === product._id);
        
        // Calculate total quantity including existing items
        const totalQuantity = (existingItem?.quantity || 0) + quantity;
        console.log('totalQuantity', totalQuantity);
        console.log('product.stock', product.stock);

        // Validate against product stock
        if (totalQuantity > product.stock) {
          showStockError(product.stock);
          return;
        }
        
        if (existingItem) {
          existingItem.quantity = totalQuantity;
        } else {
          // Store complete product information
          localCart.push({
            productId: product._id,
            quantity,
            name: product.name,
            price: product.price,
            imageUrl: product.imageUrl,
            stock: product.stock,
            sellerId: product.createdBy || product.sellerId // Ensure we capture the sellerId
          });
        }
        
        localStorage.setItem('cart', JSON.stringify(localCart));
        setCartItems(localCart);
        // Calculate total for local cart
        const newTotal = localCart.reduce((total, item) => total + (item.price * item.quantity), 0);
        setTotalAmount(newTotal);
        
        // Show success message for local cart
        setError({
          severity: 'success',
          message: 'Product added to cart successfully'
        });
      } catch (error) {
        console.error('Error adding to local cart:', error);
        setError({
          severity: 'error',
          message: 'Failed to add item to cart. Please try again.'
        });
      }
    }
  };

  const removeFromCart = async (productId) => {
    if (user && user.role === 'buyer') {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No token found');
        }

        const response = await axios.delete(`${CART_SERVICE_URL}/cart/${productId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Response from deleted cart service:', response.data);
        
        // Process the response data correctly
        const cartData = response.data.cart || response.data;
        const items = cartData.items || [];
        setCartItems(Array.isArray(items) ? items : []);
        setTotalAmount(cartData.totalAmount || 0);
      } catch (error) {
        console.error('Error removing from cart:', error);
      }
    } else {
      // Unauthenticated user - use localStorage
      try {
        const localCart = JSON.parse(localStorage.getItem('cart')) || [];
        const updatedCart = localCart.filter(item => item.productId !== productId);
        localStorage.setItem('cart', JSON.stringify(updatedCart));
        setCartItems(updatedCart);
        // Calculate total for local cart
        const newTotal = updatedCart.reduce((total, item) => total + (item.price * item.quantity), 0);
        setTotalAmount(newTotal);
      } catch (error) {
        console.error('Error removing from local cart:', error);
        setCartItems([]);
        setTotalAmount(0);
      }
    }
  };

  const updateQuantity = async (productId, quantity) => {
    console.log('1. updateQuantity called with:', { productId, quantity, type: typeof quantity });

    if (user && user.role === 'buyer') {
      console.log('2. Authenticated user flow');
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('3a. No token found');
          throw new Error('No token found');
        }

        // Validate quantity
        const validQuantity = Number(quantity);
        console.log('3b. Parsed quantity:', validQuantity);

        if (isNaN(validQuantity) || validQuantity < 1) {
          console.error('3c. Invalid quantity value');
          throw new Error('Invalid quantity. Must be a positive number.');
        }

        // Log the current cart state
        console.log('4. Current cart state:', {
          cartItems: cartItems.length,
          targetItem: cartItems.find(item => item.productId === productId)
        });

        // Find the item in the cart to verify it exists
        const cartItem = cartItems.find(item => item.productId === productId);
        if (!cartItem) {
          console.error('5a. Item not found in cart');
          throw new Error('Item not found in cart');
        }

        // Validate against stock
        if (validQuantity > cartItem.stock) {
          console.error('5b. Exceeds stock limit');
          throw new Error(`Cannot exceed available stock of ${cartItem.stock}`);
        }

        console.log('6. Sending update request:', {
          url: `${CART_SERVICE_URL}/cart/${productId}`,
          quantity: validQuantity
        });

        const response = await axios.put(
          `${CART_SERVICE_URL}/cart/${productId}`,
          { 
            quantity: validQuantity
          },
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data) {
          console.log('7. Update successful:', response.data);
          // Process the response data correctly
          const cartData = response.data.cart || response.data;
          const items = cartData.items || [];
          setCartItems(Array.isArray(items) ? items : []);
          setTotalAmount(cartData.totalAmount || 0);
        } else {
          console.error('7. Invalid response');
          throw new Error('Invalid response from cart service');
        }
      } catch (error) {
        console.error('8. Error in updateQuantity:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw error;
      }
    } else {
      console.log('2. Unauthenticated user flow');
      try {
        const validQuantity = Number(quantity);
        if (isNaN(validQuantity) || validQuantity < 1) {
          throw new Error('Invalid quantity. Must be a positive number.');
        }

        const localCart = JSON.parse(localStorage.getItem('cart')) || [];
        const updatedCart = localCart.map(item => {
          if (item.productId === productId) {
            if (validQuantity > item.stock) {
              throw new Error(`Cannot exceed available stock of ${item.stock}`);
            }
            return { ...item, quantity: validQuantity };
          }
          return item;
        });
        
        localStorage.setItem('cart', JSON.stringify(updatedCart));
        setCartItems(updatedCart);
        const newTotal = updatedCart.reduce((total, item) => total + (item.price * item.quantity), 0);
        setTotalAmount(newTotal);
      } catch (error) {
        console.error('Error updating local cart quantity:', error);
        throw error;
      }
    }
  };

  const getCartItems = () => cartItems;

  const getCartCount = () => {
    if (!Array.isArray(cartItems)) {
      console.error('cartItems is not an array:', cartItems);
      return 0;
    }
    return cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
  };

  const getTotal = () => totalAmount;

  // Add a function to clear the cart
  const clearCart = async () => {
    try {
      // Check if user is authenticated
      const token = localStorage.getItem('token');
      if (token && user && user.role === 'buyer') {
        // Clear cart in the Cart Service
        await axios.delete(`${CART_SERVICE_URL}/cart`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Cart cleared in the Cart Service');
      }
      
      // Clear local cart
      localStorage.setItem('cart', JSON.stringify([]));
      setCartItems([]);
      setTotalAmount(0);
      console.log('Cart cleared locally');
      
      return true;
    } catch (error) {
      console.error('Error clearing cart:', error);
      setError({
        message: 'Failed to clear cart. Please try again.',
        severity: 'error'
      });
      return false;
    }
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      getCartItems,
      getCartCount,
      getTotal,
      clearCart
    }}>
      {children}
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseError} 
          severity={error?.severity || 'error'} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {error?.message}
        </Alert>
      </Snackbar>
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}; 
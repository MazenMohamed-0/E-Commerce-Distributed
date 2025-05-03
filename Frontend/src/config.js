const config = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  PRODUCT_SERVICE_URL: import.meta.env.VITE_PRODUCT_SERVICE_URL || 'http://localhost:3002',
  CART_SERVICE_URL: import.meta.env.VITE_CART_SERVICE_URL || 'http://localhost:3003',
  ORDER_SERVICE_URL: import.meta.env.VITE_ORDER_SERVICE_URL || 'http://localhost:3004',
  PAYMENT_SERVICE_URL: import.meta.env.VITE_PAYMENT_SERVICE_URL || 'http://localhost:3005',
};

export default config;
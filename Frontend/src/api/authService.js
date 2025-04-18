import axios from 'axios';

const API_URL = 'http://localhost:3001/auth';

export const authService = {
  // Regular login
  async login(email, password) {
    const response = await axios.post(`${API_URL}/login`, { email, password });
    return response.data;
  },

  // Regular registration
  async register(userData) {
    const response = await axios.post(`${API_URL}/register`, userData);
    return response.data;
  },

  // Google login
  async googleLogin() {
    // Open Google OAuth in a popup window
    const width = 600;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      `${API_URL}/google`,
      'Google OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    return new Promise((resolve, reject) => {
      const messageHandler = (event) => {
        if (event.data && event.data.token) {
          window.removeEventListener('message', messageHandler);
          popup.close();
          resolve(event.data.token);
        }
      };

      window.addEventListener('message', messageHandler);
    });
  },

  // Facebook login
  async facebookLogin() {
    // Open Facebook OAuth in a popup window
    const width = 600;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      `${API_URL}/facebook`,
      'Facebook OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    return new Promise((resolve, reject) => {
      const messageHandler = (event) => {
        if (event.data && event.data.token) {
          window.removeEventListener('message', messageHandler);
          popup.close();
          resolve(event.data.token);
        }
      };

      window.addEventListener('message', messageHandler);
    });
  },

  // Store token in localStorage
  setToken(token) {
    localStorage.setItem('token', token);
    console.log('Token set:', token);
  },

  // Get token from localStorage
  getToken() {
    const token = localStorage.getItem('token');
    console.log('Token retrieved:', token);
    return token;
  },

  // Remove token from localStorage
  removeToken() {
    localStorage.removeItem('token');
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  }
}; 
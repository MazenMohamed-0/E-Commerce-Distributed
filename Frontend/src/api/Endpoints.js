import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default {
  auth: {
    login(credentials) {
      return apiClient.post('/auth/login', credentials);
    },
    signup(userData) {
      return apiClient.post('/auth/signup', userData);
    }
  },
};
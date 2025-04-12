import { defineStore } from 'pinia';
import api from '@/api/Endpoints';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: {
      id: null,
      name: null,
      email: null,
      role: null,
    },
    token: null,
  }),
  actions: {
    async login({ email, password }) {
      try {
        const response = await api.auth.login({ email, password });
        console.log(response);
        // Save the user object and token from the response
        this.user = {
          id: response.data.user.id,
          name: response.data.user.name,
          email: response.data.user.email,
          role: response.data.user.role,
        };
        this.token = response.data.token;
        localStorage.setItem('token', response.data.token); // Persist token
      } catch (error) {
        throw new Error('Invalid credentials');
      }
    },
    logout() {
      this.user = {
        id: null,
        name: null,
        email: null,
        role: null,
      };
      this.token = null;
      localStorage.removeItem('token');
    },
  },
  getters: {
    isAuthenticated: (state) => !!state.user.id, // Check if user.id exists
    userRole: (state) => state.user.role || '',  // Getter for user role
  },
});
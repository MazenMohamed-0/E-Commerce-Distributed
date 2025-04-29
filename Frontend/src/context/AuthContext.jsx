import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      console.log('Initializing auth...');
      try {
        const token = localStorage.getItem('token');
        console.log('Token from localStorage:', token);
        
        if (token) {
          console.log('Token found, fetching profile...');
          await getProfile();
        } else {
          console.log('No token found in localStorage');
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const register = async (userData) => {
    try {
      setLoading(true);
      console.log('Registration data:', userData);
      
      // Prepare registration data
      const registrationData = {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        storeInfo: {} // Initialize storeInfo object
      };

      // If role is seller, add seller fields to storeInfo
      if (userData.role === 'seller') {
        registrationData.storeInfo = {
          storeName: userData.storeInfo.storeName,
          taxNumber: userData.storeInfo.taxNumber,
          storeDescription: userData.storeInfo.storeDescription || '',
          contactNumber: userData.storeInfo.contactNumber || '',
          status: 'pending'
        };
      }

      console.log('Sending registration data:', registrationData);
      const response = await axios.post('http://localhost:3001/auth/register', registrationData);
      console.log('Registration response:', response.data);
      
      // For seller registration
      if (userData.role === 'seller') {
        // Clear any existing token to ensure they're logged out
        localStorage.removeItem('token');
        setUser(null);
        return response.data;
      }

      // For non-seller users
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setUser(response.data.user);
        setError(null);
      }
      
      return response.data;
    } catch (err) {
      console.error('Registration error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('Starting login process...');
      setLoading(true);
      const response = await axios.post('http://localhost:3001/auth/login', {
        email,
        password,
      });
      console.log('Full login response:', response);
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      // EXPLICIT CHECK for pending seller flag from backend
      if (response.data.pendingSeller === true) {
        console.log('Pending seller flag detected in response');
        // Clear any existing token to ensure they're logged out
        localStorage.removeItem('token');
        setUser(null);
        setError(response.data.message || 'Your seller account is pending approval. Please wait for admin verification.');
        // Return the response so the component can display the message
        return response.data;
      }

      // For pending seller accounts (message but no token)
      if (response.data.message && response.data.message.includes('pending approval')) {
        console.log('Pending seller account detected through message');
        // Clear any existing token to ensure they're logged out
        localStorage.removeItem('token');
        setUser(null);
        setError(response.data.message);
        // Return the response so the component can display the message
        return response.data;
      }
      
      // Check if user is a seller with pending status (additional check)
      if (response.data.user?.role === 'seller') {
        // If the user is a seller but storeInfo is missing, reconstruct it from direct attributes
        // This handles cases where the backend returns seller attributes directly on the user object
        if (!response.data.user.storeInfo && 
            (response.data.user.status === 'pending' || 
             response.data.user.storeName || 
             response.data.user.taxNumber)) {
          
          console.log('Reconstructing storeInfo from direct seller attributes');
          response.data.user.storeInfo = {
            storeName: response.data.user.storeName || '',
            taxNumber: response.data.user.taxNumber || '',
            storeDescription: response.data.user.storeDescription || '',
            contactNumber: response.data.user.contactNumber || '',
            status: response.data.user.status || 'pending'
          };
        }
        
        // Now check for pending status with the potentially reconstructed storeInfo
        if (response.data.user.storeInfo?.status === 'pending') {
          const errorMsg = 'Your seller account is pending approval. Please wait for admin verification.';
          console.log('Pending seller status detected in user object');
          // Clear any existing token to ensure they're logged out
          localStorage.removeItem('token');
          setUser(null);
          setError(errorMsg);
          // Return a response with the message but no token
          return {
            user: response.data.user,
            message: errorMsg,
            pendingSeller: true
          };
        }
      }
      
      // For successful login with token
      if (response.data && response.data.token) {
        console.log('Token found in response, saving to localStorage');
        localStorage.setItem('token', response.data.token);
        console.log('Token saved to localStorage');
        setUser(response.data.user);
        setError(null);
        return response.data;
      } 
      // Fallback error
      else {
        console.error('No token in login response:', response.data);
        throw new Error('Login failed: No token received');
      }
    } catch (err) {
      console.error('Login error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (token) => {
    try {
      console.log('Handling OAuth login...');
      setLoading(true);
      
      // Save token first
      localStorage.setItem('token', token);
      console.log('Token saved to localStorage');
      
      // Get user profile using the token
      const user = await getProfile();
      console.log('OAuth user profile:', user);
      
      if (user) {
        setUser(user);
        setError(null);

        // User with a role
        if (user.role) {
          // If seller with pending status
          if (user.role === 'seller' && user.status === 'pending') {
            console.log('Seller account is pending approval');
            setError('Your seller account is pending approval. Please wait for admin verification.');
            // Clear token and user data to keep them on login page
            localStorage.removeItem('token');
            setUser(null);
            return false;
          }
          // Any other role
          return false;
        }
        
        // User without a role
        return true;
      }
      
      // If no user profile, try to create one
      console.log('No user profile found, creating new user...');
      const response = await axios.post('http://localhost:3001/auth/oauth-user', {
        token
      });
      
      if (response.data && response.data.user) {
        setUser(response.data.user);
        setError(null);
        // Return opposite of whether they have a role
        return !response.data.user.role;
      }
      
      throw new Error('Failed to create or get user profile');
    } catch (err) {
      console.error('OAuth login error:', err);
      setError(err.message || 'OAuth login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
  };

  const getProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Making profile request with token:', token);
      
      if (!token) {
        console.log('No token available for profile request');
        return null;
      }
      
      const response = await axios.get('http://localhost:3001/auth/profile', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Profile response:', response.data);
      
      if (!response.data) {
        throw new Error('No user data received');
      }
      
      setUser(response.data);
      return response.data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      console.error('Error response:', err.response?.data);
      // Don't logout on error, just return null
      return null;
    }
  };

  const updateUserRole = async (userData) => {
    try {
      setLoading(true);
      console.log('Updating user role with data:', userData);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found in localStorage');
        throw new Error('No token found');
      }
      console.log('Token found:', token);

      const config = {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      console.log('Request config:', config);
      console.log('Making request to update role...');
      
      try {
        const response = await axios.post('http://localhost:3001/auth/update-role', userData, config);
        console.log('Update role response:', response);
        
        if (response.status === 200 && response.data) {
          console.log('Role updated successfully:', response.data);
          
          // Check if user is now a seller with pending status
          if (response.data.role === 'seller' && response.data.status === 'pending') {
            console.log('New seller account is pending approval');
            setError('Your seller account is pending approval. Please wait for admin verification.');
            // Clear token and user data
            localStorage.removeItem('token');
            setUser(null);
            return null;
          }
          
          // Save the new token if it's returned from the backend
          if (response.data.token) {
            console.log('New token received, updating localStorage');
            localStorage.setItem('token', response.data.token);
          }
          
          setUser(response.data);
          setError(null);
          return response.data;
        }
        
        throw new Error('Failed to update role: Invalid response');
      } catch (axiosError) {
        console.error('Axios error:', axiosError);
        console.error('Error response:', axiosError.response?.data);
        console.error('Error status:', axiosError.response?.status);
        throw axiosError;
      }
    } catch (err) {
      console.error('Update role error:', err);
      setError(err.message || 'Failed to update role');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Add a function to get the token
  const getToken = () => {
    return localStorage.getItem('token');
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    getProfile,
    handleOAuthLogin,
    updateUserRole,
    token: getToken() // Expose the token directly
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
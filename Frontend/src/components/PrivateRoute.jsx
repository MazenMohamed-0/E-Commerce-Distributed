import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, requireSeller = false, requireAdmin = false }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Handle seller route protection
  if (requireSeller && user.role !== 'seller') {
    return <Navigate to="/" />;
  }
  
  // Handle admin route protection
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" />;
  }
  
  // Redirect admin users to admin dashboard if they're trying to access non-admin routes
  if (!requireAdmin && user.role === 'admin') {
    return <Navigate to="/admin" />;
  }
  
  return children;
};

export default PrivateRoute;
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  MenuItem,
  Alert
} from '@mui/material';
import { useAuth } from '../context/hooks';

const SelectRole = () => {
  const [role, setRole] = useState('');
  const [storeName, setStoreName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { updateUserRole } = useAuth();
  const navigate = useNavigate();

  const handleRoleSelect = async (selectedRole) => {
    try {
      setLoading(true);
      setError('');
      
      const userData = { role: selectedRole };
      
      // Add seller-specific fields if role is seller
      if (selectedRole === 'seller') {
        userData.status = 'pending';
        userData.storeName = storeName;
        userData.taxNumber = taxNumber;
        userData.storeDescription = storeDescription;
        userData.contactNumber = contactNumber;
      }
      
      const updatedUser = await updateUserRole(userData);
      
      if (!updatedUser) {
        // If updateUserRole returns null, it means we have a pending seller
        // The error message is already set in AuthContext
        navigate('/login');
        return;
      }
      
      navigate('/');
    } catch (err) {
      console.error('Error selecting role:', err);
      setError(err.message || 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Validate seller fields if role is seller
      if (role === 'seller') {
        if (!storeName || !taxNumber) {
          setError('Store name and tax number are required for sellers');
          return;
        }
      }

      // Call handleRoleSelect with the selected role
      await handleRoleSelect(role);
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err.message || 'Failed to submit form');
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Select Your Role
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            margin="normal"
            required
          >
            <MenuItem value="buyer">Buyer</MenuItem>
            <MenuItem value="seller">Seller</MenuItem>
          </TextField>

          {/* Seller-specific fields */}
          {role === 'seller' && (
            <>
              <TextField
                fullWidth
                label="Store Name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Tax Number"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Store Description"
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                margin="normal"
                multiline
                rows={4}
              />
              <TextField
                fullWidth
                label="Contact Number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                margin="normal"
              />
            </>
          )}

          <Button
            fullWidth
            variant="contained"
            color="primary"
            type="submit"
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? 'Updating...' : 'Continue'}
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default SelectRole;
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Typography,
  Box,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import config from '../../config';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [userType, setUserType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [userType]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${config.BACKEND_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch users');
      }
      
      const data = await response.json();
      // Filter out admin users and then filter by userType if not 'all'
      const nonAdminUsers = data.filter(user => user.role !== 'admin');
      const filteredUsers = userType === 'all' 
        ? nonAdminUsers 
        : nonAdminUsers.filter(user => user.role === userType);
      
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusChange = async (userId, updates) => {
    try {
      setError(null);
      setSuccessMessage(null);
      
      const response = await fetch(`${config.BACKEND_URL}/users/admin/update-status/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          status: updates.status
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to update user status');
      }

      setSuccessMessage(`User status updated to ${updates.status} successfully`);
      await fetchUsers(); // Refresh the list after update
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error.message);
    }
  };

  const handleTabChange = (event, newValue) => {
    setUserType(newValue);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        User Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Tabs value={userType} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="All Users" value="all" />
        <Tab label="Buyers" value="buyer" />
        <Tab label="Sellers" value="seller" />
      </Tabs>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user._id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip 
                    label={user.role} 
                    color={user.role === 'seller' ? 'primary' : 'secondary'}
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={user.status} 
                    color={user.status === 'active' ? 'success' : 'warning'}
                  />
                </TableCell>
                <TableCell>
                  {user.role === 'seller' && user.status === 'pending' && (
                    <>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={() => handleUserStatusChange(user._id, { status: 'approved' })}
                        sx={{ mr: 1 }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        onClick={() => handleUserStatusChange(user._id, { status: 'rejected' })}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {user.status === 'active' && (
                    <Button
                      variant="contained"
                      color="error"
                      size="small"
                      onClick={() => handleUserStatusChange(user._id, { status: 'suspended' })}
                    >
                      Suspend
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default UserManagement; 
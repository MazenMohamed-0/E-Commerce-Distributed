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
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import config from '../../config';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [userType, setUserType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [editedUser, setEditedUser] = useState({
    name: '',
    email: '',
    role: '',
    status: ''
  });

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

  const handleOpenEditDialog = (user) => {
    setCurrentUser(user);
    setEditedUser({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setCurrentUser(null);
  };

  const handleOpenDeleteDialog = (user) => {
    setCurrentUser(user);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCurrentUser(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedUser(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateUser = async () => {
    try {
      setError(null);
      setSuccessMessage(null);
      
      const response = await fetch(`${config.BACKEND_URL}/users/admin/update-status/${currentUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editedUser)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to update user');
      }

      setSuccessMessage(`User ${editedUser.name} updated successfully`);
      handleCloseEditDialog();
      await fetchUsers(); // Refresh the list after update
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error.message);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setError(null);
      setSuccessMessage(null);
      
      const response = await fetch(`${config.BACKEND_URL}/users/admin/${currentUser._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete user');
      }

      setSuccessMessage(`User ${currentUser.name} deleted successfully`);
      handleCloseDeleteDialog();
      await fetchUsers(); // Refresh the list after deletion
    } catch (error) {
      console.error('Error deleting user:', error);
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
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* Edit Button - Always visible */}
                    <IconButton
                      color="success"
                      size="small"
                      onClick={() => handleOpenEditDialog(user)}
                      title="Edit User"
                    >
                      <EditIcon />
                    </IconButton>
                    
                    {/* Delete Button - Always visible */}
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => handleOpenDeleteDialog(user)}
                      title="Delete User"
                    >
                      <DeleteIcon />
                    </IconButton>
                    
                    {/* Status Change Buttons */}
                    {user.role === 'seller' && user.status === 'pending' && (
                      <>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => handleUserStatusChange(user._id, { status: 'approved' })}
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
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Update user information for {currentUser?.name}
          </DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Name"
              name="name"
              value={editedUser.name}
              onChange={handleInputChange}
              fullWidth
              disabled
            />
            <TextField
              label="Email"
              name="email"
              value={editedUser.email}
              onChange={handleInputChange}
              fullWidth
              disabled
            />
            <TextField
              label="Role"
              value={editedUser.role === 'buyer' ? 'Buyer' : editedUser.role === 'seller' ? 'Seller' : editedUser.role}
              fullWidth
              disabled
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={editedUser.status}
                onChange={handleInputChange}
                label="Status"
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleUpdateUser} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete user {currentUser?.name}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteUser} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;
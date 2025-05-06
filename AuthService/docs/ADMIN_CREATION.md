# Creating Admin Users

This document explains how to create administrator users in the E-Commerce Distributed system.

## Admin Registration Route

We've added a special route to create admin users which requires a secret key for security.

### Endpoint

```
POST /auth/register-admin
```

### Request Body

```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "password": "securePassword",
  "secretKey": "admin-secret-key-for-registration",
  "superAdmin": true  // Optional: Makes this admin a super admin
}
```

### Required Fields

- `name`: The admin's full name
- `email`: The admin's email address (must be unique)
- `password`: A secure password (minimum 6 characters)
- `secretKey`: Must match the ADMIN_SECRET_KEY environment variable

### Optional Fields

- `superAdmin`: Boolean flag to designate this admin as a super admin with full privileges

### Response

```json
{
  "user": {
    "id": "60d21b4667d0d8992e610c85",
    "name": "Admin Name",
    "email": "admin@example.com",
    "role": "admin",
    "permissions": {
      "canManageUsers": true,
      "canManageSellers": true,
      "canManageProducts": true,
      "canManageOrders": true,
      "superAdmin": true
    }
  },
  "token": "jwt-token-here"
}
```

## Environment Configuration

Make sure to set the `ADMIN_SECRET_KEY` in your .env file:

```
ADMIN_SECRET_KEY=your-secure-admin-secret-key
```

If not set, the system will use a default value, but this is not recommended for production.

## Creating the First Admin

1. Set your `ADMIN_SECRET_KEY` in the .env file
2. Make a POST request to `/auth/register-admin` with the required fields
3. Store the returned JWT token securely
4. Use this admin account to create additional admin users through the admin panel

## Admin Permissions

Admins have the following permissions by default:

- `canManageUsers`: Can create, update, and delete users
- `canManageSellers`: Can approve, reject, and manage seller accounts
- `canManageProducts`: Can manage product listings
- `canManageOrders`: Can view and manage orders
- `superAdmin`: Has all permissions and can manage other admins

## Security Considerations

- Keep your `ADMIN_SECRET_KEY` secure and don't expose it in client-side code
- Regularly rotate the admin secret key
- Consider implementing IP restrictions for admin registration
- Monitor admin creation logs for unauthorized attempts 
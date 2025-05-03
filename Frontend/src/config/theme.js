import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976D2', // Primary color
    },
    secondary: {
      main: '#424242', // Secondary color
    },
    accent: {
      main: '#82B1FF', // Accent color
    },
    error: {
      main: '#FF5252', // Error color
    },
    info: {
      main: '#2196F3', // Info color
    },
    success: {
      main: '#4CAF50', // Success color
    },
    warning: {
      main: '#FFC107', // Warning color
    },
    background: {
      default: '#FFFFFF', // Background color
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976D2', // Primary color
    },
    secondary: {
      main: '#424242', // Secondary color
    },
    accent: {
      main: '#82B1FF', // Accent color
    },
    error: {
      main: '#FF5252', // Error color
    },
    info: {
      main: '#2196F3', // Info color
    },
    success: {
      main: '#4CAF50', // Success color
    },
    warning: {
      main: '#FFC107', // Warning color
    },
    background: {
      default: 'rgb(12, 11, 11)', // Background color
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});
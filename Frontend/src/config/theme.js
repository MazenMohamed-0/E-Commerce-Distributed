import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#123458', // Primary color
    },
    secondary: {
      main: '#D4C9BE', // Secondary color
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
      default: '#F1EFEC', // Background color
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
      main: '#F1EFEC', // Primary color
    },
    secondary: {
      main: '#D4C9BE', // Secondary color
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
      default: '#030303', // Background color
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});
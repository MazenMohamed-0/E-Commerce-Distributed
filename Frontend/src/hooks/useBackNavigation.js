import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Custom hook to handle back navigation with special handling for checkout flow
 * 
 * @param {string} defaultBackPath Default path to navigate to if no history is available
 * @returns {Function} Function to call when back button is clicked
 */
export const useBackNavigation = (defaultBackPath = '/') => {
  const navigate = useNavigate();
  const location = useLocation();
  
  return () => {
    // Check if we came from checkout page
    const fromCheckout = location.state?.from === '/checkout' || 
                         document.referrer.includes('/checkout');
    
    // If we came from checkout, go to home
    if (fromCheckout) {
      navigate('/');
      return;
    }
    
    // If we have a previous location in history, go back
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Otherwise, go to the default back path
      navigate(defaultBackPath);
    }
  };
}; 
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import StripePaymentForm from './StripePaymentForm';

const Checkout = () => {
  const { cartItems, shippingAddress, clearCart, totalAmount } = useCart();
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [orderId, setOrderId] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!cartItems.length) {
      navigate('/cart');
    }
  }, [cartItems, navigate]);

  // Poll for order status when orderId is available
  useEffect(() => {
    let intervalId;
    
    if (orderId) {
      intervalId = setInterval(async () => {
        try {
          console.log('Polling order status for orderId:', orderId);
          const response = await axios.get(`/api/orders/${orderId}/status`);
          console.log('Order status response:', response.data);
          
          setOrderStatus(response.data);
          
          // If the order failed, stop polling and show error
          if (response.data.status === 'failed') {
            clearInterval(intervalId);
            setError(response.data.error?.message || 'Order processing failed');
          }
          
          // If payment is completed, navigate to success page
          if (response.data.status === 'completed' || response.data.status === 'payment_completed') {
            clearInterval(intervalId);
            navigateToSuccess();
          }
        } catch (err) {
          console.error('Error polling order status:', err);
        }
      }, 2000); // Poll every 2 seconds
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [orderId]);

  const handleNextStep = () => {
    setCurrentStep(step => step + 1);
  };

  const handlePreviousStep = () => {
    setCurrentStep(step => step - 1);
  };

  const handlePaymentMethodChange = (e) => {
    setPaymentMethod(e.target.value);
  };

  const submitOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Create order
      const orderData = {
        items: cartItems,
        shippingAddress,
        paymentMethod,
        totalAmount
      };
      
      console.log('Submitting order with data:', orderData);
      
      const response = await axios.post('/api/orders', orderData);
      console.log('Order creation response:', response.data);
      
      // Set orderId from response
      setOrderId(response.data.orderId);
      
      if (paymentMethod === 'stripe') {
        // For Stripe, check order status to get client secret
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkForStripeDetails = async () => {
          if (attempts >= maxAttempts) {
            setError('Unable to get payment details after multiple attempts');
            return;
          }
          
          attempts++;
          
          try {
            const statusResponse = await axios.get(`/api/orders/${response.data.orderId}/status`);
            console.log('Order status check for Stripe:', statusResponse.data);
            
            if (statusResponse.data.status === 'failed') {
              setError(statusResponse.data.error?.message || 'Order processing failed');
              return;
            }
            
            // Try to extract the client secret from various possible locations in the response
            let clientSecret = null;
            let paymentIntentId = null;
            
            // First check direct payment property
            if (statusResponse.data.payment && statusResponse.data.payment.stripeClientSecret) {
              clientSecret = statusResponse.data.payment.stripeClientSecret;
              paymentIntentId = statusResponse.data.payment.stripePaymentIntentId;
            } 
            // Then check nested payment info
            else if (statusResponse.data.order && statusResponse.data.order.payment) {
              const payment = statusResponse.data.order.payment;
              clientSecret = payment.stripeClientSecret;
              paymentIntentId = payment.stripePaymentIntentId;
            }
            // Finally check for direct properties on the response
            else if (statusResponse.data.stripeClientSecret) {
              clientSecret = statusResponse.data.stripeClientSecret;
              paymentIntentId = statusResponse.data.stripePaymentIntentId;
            }
            
            if (clientSecret) {
              console.log('Found Stripe client secret, showing payment form');
              // Got Stripe details - show payment form
              setPaymentDetails({
                clientSecret: clientSecret,
                paymentIntentId: paymentIntentId
              });
              setLoading(false);
              return;
            }
            
            console.log('No Stripe details found yet, retrying...');
            // Wait 1 second and try again
            setTimeout(checkForStripeDetails, 1000);
          } catch (err) {
            console.error('Error checking for Stripe details:', err);
            setError('Error retrieving payment information');
          }
        };
        
        checkForStripeDetails();
      } else if (paymentMethod === 'cash') {
        // Cash payments are processed directly
        setLoading(false);
        navigateToSuccess();
      }
    } catch (err) {
      console.error('Error creating order:', err.response?.data || err);
      setError(err.response?.data?.message || 'Error creating order');
      setLoading(false);
    }
  };

  const handleStripeSuccess = (paymentIntent) => {
    console.log('Payment successful:', paymentIntent);
    navigateToSuccess();
  };

  const handleStripeError = (errorMessage) => {
    console.error('Payment error:', errorMessage);
    setError(`Payment failed: ${errorMessage}`);
  };

  const navigateToSuccess = () => {
    // Clear cart, navigate to success page
    clearCart();
    navigate(`/order-success?orderId=${orderId}`);
  };

  const renderOrderErrors = () => {
    if (!error) return null;
    
    return (
      <div className="alert alert-danger mt-3">
        <p><strong>Error:</strong> {error}</p>
      </div>
    );
  };

  const renderShippingInformation = () => (
    <div>
      <h3>Shipping Information</h3>
      <form>
        <div className="form-group mb-3">
          <label htmlFor="fullName">Full Name</label>
          <input
            type="text"
            className="form-control"
            id="fullName"
            value={shippingAddress.fullName}
            readOnly
          />
        </div>
        <div className="form-group mb-3">
          <label htmlFor="addressLine1">Address Line 1</label>
          <input
            type="text"
            className="form-control"
            id="addressLine1"
            value={shippingAddress.addressLine1}
            readOnly
          />
        </div>
        <div className="form-group mb-3">
          <label htmlFor="city">City</label>
          <input
            type="text"
            className="form-control"
            id="city"
            value={shippingAddress.city}
            readOnly
          />
        </div>
        <div className="form-group mb-3">
          <label htmlFor="state">State</label>
          <input
            type="text"
            className="form-control"
            id="state"
            value={shippingAddress.state}
            readOnly
          />
        </div>
        <div className="form-group mb-3">
          <label htmlFor="postalCode">Postal Code</label>
          <input
            type="text"
            className="form-control"
            id="postalCode"
            value={shippingAddress.postalCode}
            readOnly
          />
        </div>
        <div className="form-group mb-3">
          <label htmlFor="country">Country</label>
          <input
            type="text"
            className="form-control"
            id="country"
            value={shippingAddress.country}
            readOnly
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleNextStep}
        >
          Next: Payment Method
        </button>
      </form>
    </div>
  );

  const renderPaymentMethod = () => (
    <div>
      <h3>Payment Method</h3>
      <form>
        <div className="form-check mb-3">
          <input
            className="form-check-input"
            type="radio"
            name="paymentMethod"
            id="stripe"
            value="stripe"
            checked={paymentMethod === 'stripe'}
            onChange={handlePaymentMethodChange}
          />
          <label className="form-check-label" htmlFor="stripe">
            Credit Card (Stripe)
          </label>
        </div>
        <div className="form-check mb-3">
          <input
            className="form-check-input"
            type="radio"
            name="paymentMethod"
            id="cash"
            value="cash"
            checked={paymentMethod === 'cash'}
            onChange={handlePaymentMethodChange}
          />
          <label className="form-check-label" htmlFor="cash">
            Cash on Delivery
          </label>
        </div>
        <div className="d-flex">
          <button
            type="button"
            className="btn btn-secondary me-2"
            onClick={handlePreviousStep}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleNextStep}
          >
            Next: Review Order
          </button>
        </div>
      </form>
    </div>
  );

  const renderOrderReview = () => (
    <div>
      <h3>Review Order</h3>
      <div className="card mb-3">
        <div className="card-header">
          <h5>Items</h5>
        </div>
        <div className="card-body">
          {cartItems.map((item) => (
            <div key={item.productId} className="d-flex justify-content-between mb-2">
              <span>
                {item.productName} x {item.quantity}
              </span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <hr />
          <div className="d-flex justify-content-between">
            <strong>Total:</strong>
            <strong>${totalAmount.toFixed(2)}</strong>
          </div>
        </div>
      </div>
      
      <div className="card mb-3">
        <div className="card-header">
          <h5>Shipping Address</h5>
        </div>
        <div className="card-body">
          <p>
            {shippingAddress.fullName}<br />
            {shippingAddress.addressLine1}<br />
            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}<br />
            {shippingAddress.country}
          </p>
        </div>
      </div>
      
      <div className="card mb-3">
        <div className="card-header">
          <h5>Payment Method</h5>
        </div>
        <div className="card-body">
          {paymentMethod === 'stripe' && <p>Credit Card (Stripe)</p>}
          {paymentMethod === 'cash' && <p>Cash on Delivery</p>}
        </div>
      </div>
      
      <div className="d-flex">
        <button
          type="button"
          className="btn btn-secondary me-2"
          onClick={handlePreviousStep}
        >
          Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submitOrder}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </div>
    </div>
  );

  const renderProcessingOrder = () => (
    <div>
      <h3>Processing Your Order</h3>
      {error && (
        <div className="alert alert-danger">
          <p>{error}</p>
          <button 
            className="btn btn-outline-danger mt-2"
            onClick={() => navigate('/cart')}
          >
            Return to Cart
          </button>
        </div>
      )}
      
      {!error && !paymentDetails && (
        <div className="text-center my-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Please wait while we process your order...</p>
        </div>
      )}
      
      {paymentMethod === 'stripe' && paymentDetails && (
        <StripePaymentForm
          orderId={orderId}
          clientSecret={paymentDetails.clientSecret}
          paymentIntentId={paymentDetails.paymentIntentId}
          onSuccess={handleStripeSuccess}
          onError={handleStripeError}
        />
      )}
    </div>
  );

  return (
    <div className="container mt-5">
      <div className="row mb-4">
        <div className="col">
          <div className="checkout-steps d-flex justify-content-between">
            <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-text">Shipping Information</div>
            </div>
            <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-text">Payment Method</div>
            </div>
            <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
              <div className="step-number">3</div>
              <div className="step-text">Review Order</div>
            </div>
          </div>
        </div>
      </div>
      
      {renderOrderErrors()}
      
      <div className="row">
        <div className="col-md-8">
          {currentStep === 1 && renderShippingInformation()}
          {currentStep === 2 && renderPaymentMethod()}
          {currentStep === 3 && renderOrderReview()}
          {currentStep === 4 && renderProcessingOrder()}
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5>Order Summary</h5>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between mb-2">
                <span>Items ({cartItems.reduce((total, item) => total + item.quantity, 0)}):</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>Shipping:</span>
                <span>$0.00</span>
              </div>
              <hr />
              <div className="d-flex justify-content-between">
                <strong>Total:</strong>
                <strong>${totalAmount.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout; 
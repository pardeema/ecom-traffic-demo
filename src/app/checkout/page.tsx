// src/app/checkout/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { CartItem, Order, ShippingAddress } from '@/types';

interface FormData {
  fullName: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  paymentMethod: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
}

export default function Checkout() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
    paymentMethod: 'credit-card',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [orderComplete, setOrderComplete] = useState<boolean>(false);
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);
  
  const router = useRouter();
  
  useEffect(() => {
    // Get cart items from localStorage
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    // If cart is empty, redirect to cart page
    if (cart.length === 0) {
      router.push('/cart');
      return;
    }
    
    // Ensure quantity property exists
    const updatedCart = cart.map((item: CartItem) => ({
      ...item,
      quantity: item.quantity || 1
    }));
    
    setCartItems(updatedCart);
    setLoading(false);
  }, [router]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.fullName || !formData.email || !formData.address) {
      setError('Please fill out all required fields');
      return;
    }
    
    setError('');
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: cartItems,
          shippingAddress: {
            name: formData.fullName,
            email: formData.email,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            country: formData.country
          },
          paymentMethod: formData.paymentMethod
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      
      // Order successful
      setOrderComplete(true);
      setOrderDetails(data.order);
      
      // Clear cart
      localStorage.setItem('cart', JSON.stringify([]));
      
      // Trigger event
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (orderComplete && orderDetails) {
    return (
      <main>
        <Header />
        <div className="order-complete">
          <div className="order-success">
            <h1>Thank You For Your Order!</h1>
            <p>Your order has been placed successfully.</p>
            
            <div className="order-details">
              <h2>Order Details</h2>
              <p><strong>Order ID:</strong> {orderDetails.id}</p>
              <p><strong>Status:</strong> {orderDetails.status}</p>
              <p><strong>Date:</strong> {new Date(orderDetails.createdAt).toLocaleString()}</p>
              <p><strong>Total:</strong> ${orderDetails.total.toFixed(2)}</p>
            </div>
            
            <button 
              className="back-to-shop"
              onClick={() => router.push('/')}
            >
              Continue Shopping
            </button>
          </div>
          
          <style jsx>{`
            .order-complete {
              padding: 40px 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            
            .order-success {
              text-align: center;
              padding: 30px;
              background-color: #f8f8f8;
              border-radius: 8px;
            }
            
            .order-details {
              margin: 30px 0;
              text-align: left;
              background-color: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            
            .back-to-shop {
              background-color: #0070f3;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 1.1rem;
            }
          `}</style>
        </div>
      </main>
    );
  }
  
  return (
    <main>
      <Header />
      <div className="checkout-page">        
        <h1 className="page-title">Checkout</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="checkout-container">
          <div className="checkout-form">
            <form onSubmit={handleSubmit}>
              <div className="form-section">
                <h2>Shipping Information</h2>
                
                <div className="form-group">
                  <label htmlFor="fullName">Full Name *</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="address">Address *</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city">City</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="state">State</label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="zipCode">Zip Code</label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="country">Country</label>
                    <select
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                    >
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="Japan">Japan</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="form-section">
                <h2>Payment Method</h2>
                
                <div className="payment-options">
                  <div className="payment-option">
                    <input
                      type="radio"
                      id="credit-card"
                      name="paymentMethod"
                      value="credit-card"
                      checked={formData.paymentMethod === 'credit-card'}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="credit-card">Credit Card</label>
                  </div>
                  
                  <div className="payment-option">
                    <input
                      type="radio"
                      id="paypal"
                      name="paymentMethod"
                      value="paypal"
                      checked={formData.paymentMethod === 'paypal'}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="paypal">PayPal</label>
                  </div>
                </div>
                
                {formData.paymentMethod === 'credit-card' && (
                  <div className="credit-card-fields">
                    <div className="form-group">
                      <label htmlFor="cardNumber">Card Number</label>
                      <input
                        type="text"
                        id="cardNumber"
                        name="cardNumber"
                        value={formData.cardNumber}
                        onChange={handleInputChange}
                        placeholder="**** **** **** ****"
                      />
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="cardExpiry">Expiry Date</label>
                        <input
                          type="text"
                          id="cardExpiry"
                          name="cardExpiry"
                          value={formData.cardExpiry}
                          onChange={handleInputChange}
                          placeholder="MM/YY"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="cardCvv">CVV</label>
                        <input
                          type="text"
                          id="cardCvv"
                          name="cardCvv"
                          value={formData.cardCvv}
                          onChange={handleInputChange}
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <button 
                type="submit" 
                className="place-order-btn"
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Place Order'}
              </button>
            </form>
          </div>
          
          <div className="order-summary">
            <h2>Order Summary</h2>
            
            <div className="cart-items">
              {cartItems.map((item, index) => (
                <div key={index} className="summary-item">
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-quantity">x{item.quantity}</span>
                  </div>
                  <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            
            <div className="summary-totals">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <style jsx>{`
          .checkout-page {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
          }
          
          .page-title {
            margin-bottom: 30px;
            text-align: center;
          }
          
          .error-message {
            background-color: #ffebee;
            color: #d32f2f;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
          }
          
          .checkout-container {
            display: flex;
            flex-direction: column;
          }
          
          @media (min-width: 768px) {
            .checkout-container {
              flex-direction: row;
              gap: 30px;
            }
            
            .checkout-form {
              flex: 3;
            }
            
            .order-summary {
              flex: 2;
            }
          }
          
          .form-section {
            margin-bottom: 30px;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .form-section h2 {
            margin-top: 0;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
          }
          
          .form-group {
            margin-bottom: 15px;
          }
          
          .form-row {
            display: flex;
            gap: 15px;
          }
          
          .form-row .form-group {
            flex: 1;
          }
          
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
          }
          
          input, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
          }
          
          .payment-options {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
          }
          
          .payment-option {
            display: flex;
            align-items: center;
            gap: 5px;
          }
          
          .payment-option input {
            width: auto;
          }
          
          .credit-card-fields {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #eee;
          }
          
          .place-order-btn {
            width: 100%;
            padding: 12px;
            background-color: #0070f3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1.1rem;
            margin-top: 20px;
          }
          
          .place-order-btn:hover {
            background-color: #0060df;
          }
          
          .place-order-btn:disabled {
            background-color: #ccc;
            cursor: not-allowed;
          }
          
          .order-summary {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
            position: sticky;
            top: 20px;
          }
          
          @media (min-width: 768px) {
            .order-summary {
              margin-top: 0;
            }
          }
          
          .order-summary h2 {
            margin-top: 0;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
          }
          
          .cart-items {
            margin-bottom: 20px;
          }
          
          .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
          }
          
          .item-info {
            display: flex;
            flex-direction: column;
          }
          
          .item-name {
            font-weight: 500;
          }
          
          .item-quantity {
            color: #666;
            font-size: 14px;
          }
          
          .summary-totals {
            margin-top: 20px;
          }
          
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          
          .summary-row.total {
            font-weight: bold;
            font-size: 1.2rem;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 10px;
          }
          
          .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            font-size: 18px;
          }
        `}</style>
      </div>
    </main>
  );
}

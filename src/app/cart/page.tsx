// src/app/cart/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { CartItem } from '@/types';

export default function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    // Get cart items from localStorage
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartItems(cart);
    setLoading(false);
  }, []);
  
  const removeItem = (index: number) => {
    const updatedCart = [...cartItems];
    updatedCart.splice(index, 1);
    
    // Update localStorage
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    
    // Update state
    setCartItems(updatedCart);
    
    // Trigger event
    window.dispatchEvent(new Event('cartUpdated'));
  };
  
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    const updatedCart = [...cartItems];
    updatedCart[index] = {
      ...updatedCart[index],
      quantity: newQuantity
    };
    
    // Update localStorage
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    
    // Update state
    setCartItems(updatedCart);
    
    // Trigger event
    window.dispatchEvent(new Event('cartUpdated'));
  };
  
  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.price * (item.quantity || 1));
    }, 0);
  };
  
  const proceedToCheckout = () => {
    if (cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }
    
    router.push('/checkout');
  };
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  return (
    <main>
      <Header />
      <div className="cart-page">
        <h1 className="page-title">Shopping Cart</h1>
        
        {cartItems.length === 0 ? (
          <div className="empty-cart">
            <p>Your cart is empty</p>
            <Link href="/">
              <button className="continue-shopping">Continue Shopping</button>
            </Link>
          </div>
        ) : (
          <div className="cart-content">
            <div className="cart-items">
              {cartItems.map((item, index) => (
                <div key={index} className="cart-item">
                  <div className="item-details">
                    <h3>{item.name}</h3>
                    <p className="item-price">${item.price.toFixed(2)}</p>
                  </div>
                  
                  <div className="item-quantity">
                    <button 
                      onClick={() => updateQuantity(index, (item.quantity || 1) - 1)}
                      disabled={(item.quantity || 1) <= 1}
                    >
                      -
                    </button>
                    <span>{item.quantity || 1}</span>
                    <button onClick={() => updateQuantity(index, (item.quantity || 1) + 1)}>
                      +
                    </button>
                  </div>
                  
                  <div className="item-subtotal">
                    ${((item.quantity || 1) * item.price).toFixed(2)}
                  </div>
                  
                  <button className="remove-item" onClick={() => removeItem(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            
            <div className="cart-summary">
              <div className="summary-item">
                <span>Subtotal:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <span>Shipping:</span>
                <span>Free</span>
              </div>
              <div className="summary-item total">
                <span>Total:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
              
              <button 
                className="checkout-button"
                onClick={proceedToCheckout}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
        
        <style jsx>{`
          .cart-page {
            padding: 20px;
          }
          
          .page-title {
            margin-bottom: 30px;
            text-align: center;
          }
          
          .empty-cart {
            text-align: center;
            padding: 50px 0;
          }
          
          .continue-shopping {
            background-color: #0070f3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 20px;
          }
          
          .cart-content {
            display: flex;
            flex-direction: column;
          }
          
          @media (min-width: 768px) {
            .cart-content {
              flex-direction: row;
              gap: 30px;
            }
            
            .cart-items {
              flex: 2;
            }
            
            .cart-summary {
              flex: 1;
            }
          }
          
          .cart-items {
            margin-bottom: 30px;
          }
          
          .cart-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            border-bottom: 1px solid #ddd;
            flex-wrap: wrap;
          }
          
          .item-details {
            flex: 2;
          }
          
          .item-details h3 {
            margin: 0 0 5px 0;
          }
          
          .item-price {
            color: #666;
            margin: 0;
          }
          
          .item-quantity {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .item-quantity button {
            width: 30px;
            height: 30px;
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
          }
          
          .item-quantity button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .item-subtotal {
            font-weight: bold;
            min-width: 80px;
            text-align: right;
          }
          
          .remove-item {
            background: none;
            border: none;
            color: #ff4d4f;
            cursor: pointer;
          }
          
          .cart-summary {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            position: sticky;
            top: 20px;
          }
          
          .summary-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          
          .summary-item.total {
            font-weight: bold;
            font-size: 1.2rem;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 10px;
          }
          
          .checkout-button {
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
          
          .checkout-button:hover {
            background-color: #0060df;
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

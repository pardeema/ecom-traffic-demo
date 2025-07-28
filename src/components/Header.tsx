// src/components/Header.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from '@/types';

const Header: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [cartItems, setCartItems] = useState<number>(0);
  const router = useRouter();
  
  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    
    // Get cart items count
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartItems(cart.length);
    
    // Add event listener for cart updates
    const handleCartUpdate = () => {
      const updatedCart = JSON.parse(localStorage.getItem('cart') || '[]');
      setCartItems(updatedCart.length);
    };
    
    window.addEventListener('cartUpdated', handleCartUpdate);
    
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };
  
  return (
    <header className="header">
      <div className="logo">
        <Link href="/">Demo Shop</Link>
      </div>
      
      <nav className="nav">
        <Link href="/" className="nav-link">
          Products
        </Link>
        
        <Link href="/cart" className="nav-link">
          Cart ({cartItems})
        </Link>
        
        {user ? (
          <>
            <Link href="/dashboard" className="nav-link">
              Dashboard
            </Link>
            
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="nav-link">
              Login
            </Link>
            <Link href="/captcha-login" className="nav-link">
              Login with CAPTCHA
            </Link>
          </>
        )}
      </nav>
      
      <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background-color: #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .logo a {
          font-size: 1.5rem;
          font-weight: bold;
          color: #0070f3;
          text-decoration: none;
        }
        
        .nav {
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }
        
        .nav-link {
          color: #333;
          text-decoration: none;
        }
        
        .nav-link:hover {
          color: #0070f3;
        }
        
        .logout-btn {
          background: none;
          border: none;
          color: #333;
          cursor: pointer;
          font-size: 1rem;
          padding: 0;
        }
        
        .logout-btn:hover {
          color: #0070f3;
        }
      `}</style>
    </header>
  );
};

export default Header;

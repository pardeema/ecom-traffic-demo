// src/components/ProductCard.tsx
import { useState } from 'react';
import Image from 'next/image'; // Import Next.js Image component
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [adding, setAdding] = useState<boolean>(false);
  
  const addToCart = () => {
    setAdding(true);
    
    // Get current cart from localStorage
    const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    // Add product to cart
    const updatedCart = [...currentCart, { ...product, quantity: 1 }];
    
    // Save updated cart to localStorage
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('cartUpdated'));
    
    // Reset adding state after 1 second
    setTimeout(() => {
      setAdding(false);
    }, 1000);
  };
  
  return (
    <div className="product-card">
      <div className="product-image-wrapper"> {/* Added a wrapper for consistent sizing */} 
        {product.imageUrl ? (
          <Image 
            src={product.imageUrl} 
            alt={product.name} 
            width={280} // Set a fixed width
            height={200} // Set a fixed height
            objectFit="cover" // Ensures the image covers the area, cropping if necessary
          />
        ) : (
          <div className="placeholder">Product Image</div>
        )}
      </div>
      
      <div className="product-details">
        <h3>{product.name}</h3>
        <p className="product-price">${product.price.toFixed(2)}</p>
        <p className="product-description">{product.description}</p>
        
        <button 
          onClick={addToCart} 
          disabled={adding}
          className="add-to-cart-btn"
        >
          {adding ? 'Adding...' : 'Add to Cart'}
        </button>
      </div>
      
      <style jsx>{`
        .product-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          display: flex; /* Added for flex layout */
          flex-direction: column; /* Stack items vertically */
        }
        
        .product-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }
        
        .product-image-wrapper { /* Styles for the image wrapper */
          width: 100%;
          height: 200px; /* Fixed height for the image area */
          position: relative; /* For Next/Image layout fill or object-fit */
          background-color: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden; /* To ensure image respects border radius of card */
        }
        
        .placeholder {
          color: #666;
          font-size: 18px;
          text-align: center;
        }
        
        .product-details {
          padding: 15px;
          flex-grow: 1; /* Allow details to take remaining space */
          display: flex; /* Added for flex layout */
          flex-direction: column; /* Stack items vertically */
        }
        
        .product-price {
          font-size: 18px;
          font-weight: bold;
          color: #0070f3;
          margin: 5px 0;
        }
        
        .product-description {
          color: #666;
          margin-bottom: 15px;
          flex-grow: 1; /* Allow description to take available space */
        }
        
        .add-to-cart-btn {
          background-color: #0070f3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
          margin-top: auto; /* Push button to the bottom */
        }
        
        .add-to-cart-btn:hover {
          background-color: #0060df;
        }
        
        .add-to-cart-btn:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ProductCard;

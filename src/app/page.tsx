// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import Header from '@/components/Header';
import { Product } from '@/types';

// Sample product data
const sampleProducts: Product[] = [
  {
    id: 1,
    name: 'Wireless Headphones',
    price: 99.99,
    description: 'Premium wireless headphones with noise cancellation.',
    imageUrl: 'https://images.botdemo.net/headphones.jpeg'
  },
  {
    id: 2,
    name: 'Smartphone Case',
    price: 24.99,
    description: 'Durable protective case for your smartphone.',
    imageUrl: 'https://images.botdemo.net/smartphone-case.jpeg'
  },
  {
    id: 3,
    name: 'Smartwatch',
    price: 149.99,
    description: 'Feature-packed smartwatch with health monitoring.',
    imageUrl: 'https://images.botdemo.net/smartwatch.jpeg'
  },
  {
    id: 4,
    name: 'Bluetooth Speaker',
    price: 79.99,
    description: 'Portable speaker with amazing sound quality.',
    imageUrl: 'https://images.botdemo.net/bluetooth-speaker.jpeg'
  },
  {
    id: 5,
    name: 'Wireless Earbuds',
    price: 59.99,
    description: 'Comfortable earbuds with long battery life.',
    imageUrl: 'https://images.botdemo.net/wireless-earbuds.jpeg'
  },
  {
    id: 6,
    name: 'Laptop Backpack',
    price: 49.99,
    description: 'Spacious backpack with laptop compartment and USB charging port.',
    imageUrl: 'https://images.botdemo.net/backpack.jpeg'
  }
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  
  useEffect(() => {
    // In a real app, you would fetch products from an API
    // For this demo, we'll use the sample products
    setProducts(sampleProducts);
    
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    if (!userData) {
      // Initialize empty cart if not exists
      if (!localStorage.getItem('cart')) {
        localStorage.setItem('cart', JSON.stringify([]));
      }
    }
  }, []);
  
  return (
    <main>
      <Header />
      <div className="products-page">        
        <h1 className="page-title">Our Products</h1>
        
        <div className="products-grid">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        
        <style jsx>{`
          .products-page {
            padding: 20px;
          }
          
          .page-title {
            margin-bottom: 30px;
            text-align: center;
          }
          
          .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
          }
        `}</style>
      </div>
    </main>
  );
}

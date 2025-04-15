// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import Header from '@/components/Header';

export default function DashboardPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user');
    if (!userData) {
      // Redirect to login page
      router.push('/login');
    } else {
      setIsLoggedIn(true);
    }
    setIsLoading(false);
  }, [router]);
  
  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (!isLoggedIn) {
    return null; // Will redirect to login
  }
  
  return (
    <main>
      <Header />
      <div className="dashboard-page">
        <Dashboard />
        
        <style jsx>{`
          .dashboard-page {
            padding: 20px;
            background: #f5f5f5;
            min-height: calc(100vh - 60px);
          }
          
          .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-size: 18px;
          }
        `}</style>
      </div>
    </main>
  );
}

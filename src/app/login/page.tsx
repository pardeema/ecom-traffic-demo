// src/app/login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import Header from '@/components/Header';

export default function Login() {
  const router = useRouter();
  
  useEffect(() => {
    // Check if user is already logged in
    const userData = localStorage.getItem('user');
    if (userData) {
      // Redirect to home page
      router.push('/');
    }
  }, [router]);
  
  return (
    <main>
      <Header />
      <div className="login-page">
        <LoginForm />
        
        <style jsx>{`
          .login-page {
            padding: 40px 20px;
          }
        `}</style>
      </div>
    </main>
  );
}

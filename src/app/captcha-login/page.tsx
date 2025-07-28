// src/app/captcha-login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CaptchaLoginForm from '@/components/CaptchaLoginForm';
import Header from '@/components/Header';

export default function CaptchaLogin() {
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
      <div className="captcha-login-page">
        <CaptchaLoginForm />
        
        <style jsx>{`
          .captcha-login-page {
            padding: 40px 20px;
          }
        `}</style>
      </div>
    </main>
  );
} 
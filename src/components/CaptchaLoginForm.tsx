// src/components/CaptchaLoginForm.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
    };
  }
}

const CaptchaLoginForm: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [widgetId, setWidgetId] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    // Load Cloudflare Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      // Render the CAPTCHA widget
      if (window.turnstile) {
        const id = window.turnstile.render('#captcha-container', {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA', // Default test key
          callback: (token: string) => {
            setCaptchaToken(token);
          },
          'expired-callback': () => {
            setCaptchaToken('');
          },
          'error-callback': () => {
            setCaptchaToken('');
          }
        });
        setWidgetId(id);
      }
    };

    return () => {
      // Cleanup script
      const existingScript = document.querySelector('script[src*="turnstile"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!captchaToken) {
      setError('Please complete the CAPTCHA');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/captcha-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password, 
          captchaToken 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      // Save user data to local storage
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Reset CAPTCHA
      if (window.turnstile && widgetId) {
        window.turnstile.reset(widgetId);
      }
      setCaptchaToken('');
      
      // Redirect to home page
      router.push('/');
    } catch (err: any) {
      setError(err.message);
      // Reset CAPTCHA on error
      if (window.turnstile && widgetId) {
        window.turnstile.reset(widgetId);
      }
      setCaptchaToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="captcha-login-form">
      <h1>Login with CAPTCHA Protection</h1>
      
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>CAPTCHA Verification</label>
          <div id="captcha-container" className="captcha-container"></div>
        </div>
        
        <button type="submit" disabled={loading || !captchaToken}>
          {loading ? 'Logging in...' : 'Login with CAPTCHA'}
        </button>
      </form>
      
      <div className="demo-credentials">
        <p>Demo credentials:</p>
        <ul>
          <li>Email: user@example.com</li>
          <li>Password: K4sad@!</li>
        </ul>
        <p className="captcha-note">
          <strong>Note:</strong> This form is protected by Cloudflare Turnstile CAPTCHA.
          You must complete the CAPTCHA verification before logging in.
        </p>
      </div>
      
      <style jsx>{`
        .captcha-login-form {
          max-width: 400px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .captcha-container {
          display: flex;
          justify-content: center;
          margin: 10px 0;
          min-height: 65px;
        }
        
        button {
          width: 100%;
          padding: 10px;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        button:hover {
          background-color: #0060df;
        }
        
        button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        
        .error {
          color: red;
          margin-bottom: 15px;
          padding: 10px;
          background-color: #ffebee;
          border-radius: 4px;
        }
        
        .demo-credentials {
          margin-top: 20px;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 4px;
        }
        
        .demo-credentials ul {
          padding-left: 20px;
        }
        
        .captcha-note {
          margin-top: 10px;
          font-size: 0.9em;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default CaptchaLoginForm; 
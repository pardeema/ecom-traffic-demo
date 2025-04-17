// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'E-commerce Demo',
  description: 'Simple e-commerce demo with traffic visualization',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Insert Kasada scripts directly in head - this is the most reliable approach */}
      <head>
        <script
          type="application/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('kpsdk-load', function () {
                window.KPSDK.configure([
                  {
                    protocol: 'https',
                    method: '*',
                    domain: 'shop.botdemo.net',
                    path: '/api/auth/login*'
                  },
                  {
                    protocol: 'https',
                    method: '*',
                    domain: 'shop.botdemo.net',
                    path: '/api/checkout*'
                  },
                ]);
              });
            `
          }}
        />
        <script 
          type="application/javascript"
          src="/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/p.js"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
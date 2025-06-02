import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.botdemo.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

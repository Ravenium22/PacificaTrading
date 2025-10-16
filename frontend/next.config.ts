import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  // Ensure Next.js traces using the frontend folder as the root
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    // Proxy Pacifica API to avoid CORS and centralize base URL
    const base = process.env.NEXT_PUBLIC_PACIFICA_API_URL || 'https://api.pacifica.fi/api/v1';
    return [
      {
        source: '/pacifica/:path*',
        destination: `${base}/:path*`,
      },
    ];
  },
  webpack: (config) => {
    // Avoid writing large cache files when disk space is constrained
    // https://webpack.js.org/configuration/cache/
    // Next.js sets filesystem cache by default; disable it here.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - webpack types aren't fully surfaced in Next types
    config.cache = false;
    return config;
  },
};

export default nextConfig;

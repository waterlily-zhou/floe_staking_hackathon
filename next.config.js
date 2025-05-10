/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  // Skip TypeScript type checking during development for faster startup
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during development
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Increase the memory limit for the build process
  experimental: {
  }
};

module.exports = nextConfig;

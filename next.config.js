/** @type {import('next').NextConfig} */
const nextConfig = {
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

export default nextConfig;

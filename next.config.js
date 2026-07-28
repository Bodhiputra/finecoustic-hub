/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fewer dev overlays → less RSC manifest churn during hot reload.
  devIndicators: false,
  experimental: {
    // Middleware buffers request bodies (default 10MB); uploads allow up to 30MB video.
    middlewareClientMaxBodySize: '18mb',
  },
  async redirects() {
    return [
      { source: '/api/v1/warzone/:path*', destination: '/api/v1/internal/:path*', permanent: true },
      { source: '/api/warzone/:path*', destination: '/api/internal/:path*', permanent: true },
      { source: '/warzone', destination: '/tasks', permanent: true },
      { source: '/warzone/:department', destination: '/:department', permanent: true },
    ];
  },
};

module.exports = nextConfig;

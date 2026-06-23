/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Middleware buffers request bodies (default 10MB); uploads allow up to 30MB video.
    middlewareClientMaxBodySize: '18mb',
  },
};

module.exports = nextConfig;

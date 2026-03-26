/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Tree-shake large packages — reduces JS sent to the client
    optimizePackageImports: ["framer-motion"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;


/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Listing photos come from many dealer/CDN hosts; allow remote images.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;

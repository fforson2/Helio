import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.unsplash.com" },
      { hostname: "api.mapbox.com" },
    ],
  },
  serverExternalPackages: ["jspdf"],
};

export default nextConfig;

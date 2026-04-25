import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.unsplash.com" },
      { hostname: "api.mapbox.com" },
    ],
  },
  serverExternalPackages: ["jspdf", "better-sqlite3"],
};

export default nextConfig;

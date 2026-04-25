import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.unsplash.com" },
      { hostname: "maps.googleapis.com" },
      { hostname: "maps.gstatic.com" },
    ],
  },
  serverExternalPackages: ["jspdf", "better-sqlite3"],
};

export default nextConfig;

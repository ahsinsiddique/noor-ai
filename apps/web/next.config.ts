import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API routes stream SSE — disable static optimisation on them.
  experimental: {
    // multipart form uploads up to 25MB for audio transcription
    serverActions: { bodySizeLimit: "25mb" },
  },
  // Permissive CORS so the Expo client can call the API from any origin
  // (dev builds, published web, etc.). Tighten `Access-Control-Allow-Origin`
  // in production if you serve only a known origin.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, Accept",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

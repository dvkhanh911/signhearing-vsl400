import type { NextConfig } from "next";
import { backendRewrites } from "./src/lib/deployment";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // The current Services deployment returns 404 for /_next/image.
  // Serve the bundled public images directly on both local and Vercel.
  images: { unoptimized: true },
  experimental: { globalNotFound: true },
  async rewrites() {
    return {
      beforeFiles: backendRewrites(),
    };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};
export default config;

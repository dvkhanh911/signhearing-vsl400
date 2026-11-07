import type { NextConfig } from "next";
import { backendUrl } from "./src/lib/deployment";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { globalNotFound: true },
  async rewrites() {
    const backend = backendUrl();
    if (!backend) return [];
    return {
      beforeFiles: [
        { source: "/login", destination: `${backend}/login` },
        { source: "/app/:path*", destination: `${backend}/app/:path*` },
        { source: "/static/:path*", destination: `${backend}/static/:path*` },
        { source: "/api/:path*", destination: `${backend}/api/:path*` },
      ],
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

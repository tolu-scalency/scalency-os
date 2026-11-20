import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nothing in the app may be shown inside another website, except public forms,
  // which are made to be embedded.
  async headers() {
    return [
      { source: "/:path((?!f/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      { source: "/f/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

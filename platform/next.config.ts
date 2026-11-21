import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify's name and ID for this site, read while building (not secret). Used to show
  // the right DNS records for clients' own domains and to add those domains to Netlify.
  env: {
    NETLIFY_SITE_NAME: process.env.SITE_NAME ?? "",
    NETLIFY_BUILD_SITE_ID: process.env.SITE_ID ?? "",
  },
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

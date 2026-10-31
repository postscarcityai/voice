import type { NextConfig } from "next";

// Sites allowed to show a call screen (/s/...) inside their own page, e.g. a
// client's dashboard: space-separated origins. Everything else can't be framed.
const frameAncestors = ["'self'", ...(process.env.FRAME_ANCESTORS ?? "").split(/\s+/).filter(Boolean)].join(" ");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Share links carry their token in the URL; don't hand it to other sites
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
        ],
      },
      // Nothing but the call screen can be framed
      { source: "/:path((?!s/).*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      { source: "/s/:token", headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` }] },
    ];
  },
  async redirects() {
    return [{ source: "/", destination: "/admin", permanent: false }];
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

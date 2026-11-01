import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Chromium (copie des sites suivis) : ses fichiers compressés ne sont pas repérés tout seuls, on les ajoute
  // uniquement à la route qui fait les copies
  outputFileTracingIncludes: {
    "/api/bibliotheque/copie": ["./node_modules/@sparticuz/chromium/bin/**"],
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

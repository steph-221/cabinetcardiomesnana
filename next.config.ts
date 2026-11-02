import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Copie des sites suivis : les fichiers de Chromium (compressés) et ceux que Playwright lit à l'exécution
  // (browsers.json, package.json, cli.js…) ne sont pas repérés tout seuls. On les ajoute uniquement à la route
  // qui fait les copies.
  outputFileTracingIncludes: {
    "/api/bibliotheque/copie": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/**"],
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

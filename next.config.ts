import type { NextConfig } from "next";

// En-têtes de sécurité de toutes les pages.
// - frame-ancestors / X-Frame-Options : le site ne peut pas être affiché dans la page d'un autre site (clickjacking).
// - La CSP ne limite pas les scripts (script-src) : cela demande un nonce par requête, donc un rendu dynamique de
//   toutes les pages (voir node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// - Permissions-Policy : la dictée vocale utilise le micro, l'ajout d'examen l'appareil photo.
const entetesSecurite = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: entetesSecurite },
      // Pages de l'espace cabinet : jamais gardées en cache ni indexées
      {
        source: "/:lang/espace/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
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

import type { MetadataRoute } from "next";

// Espace cabinet installable sur téléphone (« Ajouter à l'écran d'accueil ») pour dicter hors du bureau
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Espace cabinet",
    short_name: "Cabinet",
    start_url: "/fr/espace",
    scope: "/fr/espace",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#dc2626",
    icons: [{ src: "/logo-signature.png", sizes: "any", type: "image/png" }],
  };
}

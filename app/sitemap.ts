import type { MetadataRoute } from "next";
import { cabinet, langues } from "./cabinet";
import { pagesPubliques } from "./referencement";

export default function sitemap(): MetadataRoute.Sitemap {
  return pagesPubliques.flatMap((chemin) =>
    langues.map((langue) => ({
      url: `${cabinet.site}/${langue}${chemin}`,
      changeFrequency: "monthly" as const,
      priority: chemin === "" ? 1 : chemin === "/rendez-vous" ? 0.8 : 0.3,
      alternates: {
        languages: Object.fromEntries(langues.map((l) => [l, `${cabinet.site}/${l}${chemin}`])),
      },
    })),
  );
}

import type { MetadataRoute } from "next";
import { cabinet } from "./cabinet";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/*/espace" },
    sitemap: `${cabinet.site}/sitemap.xml`,
  };
}

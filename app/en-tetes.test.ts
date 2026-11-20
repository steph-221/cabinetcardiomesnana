import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

// Porte « navigateur » : les en-têtes de sécurité doivent rester en place sur toutes les pages.
describe("en-têtes de sécurité", () => {
  it("toutes les pages ont les protections de base", async () => {
    const regles = await nextConfig.headers!();
    const toutes = Object.fromEntries(regles.find((r) => r.source === "/:path*")!.headers.map((h) => [h.key, h.value]));
    expect(toutes["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(toutes["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
    expect(toutes["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(toutes["X-Content-Type-Options"]).toBe("nosniff");
    expect(toutes["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
    expect(toutes["Referrer-Policy"]).toBeTruthy();
  });

  it("l'espace cabinet n'est jamais mis en cache ni indexé", async () => {
    const regles = await nextConfig.headers!();
    const espace = regles.find((r) => r.source.includes("/espace"))!;
    expect(espace.headers.find((h) => h.key === "Cache-Control")?.value).toContain("no-store");
  });

  it("aucune carte de code source n'est publiée au navigateur", () => {
    expect((nextConfig as { productionBrowserSourceMaps?: boolean }).productionBrowserSourceMaps).toBeFalsy();
  });
});

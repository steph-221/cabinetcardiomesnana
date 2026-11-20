import { beforeEach, describe, expect, it, vi } from "vitest";

// Porte « webhook » : la réception des résultats d'analyses (seule entrée externe de l'appli).
const SECRET = "secret-de-test-assez-long-0123456789";
vi.stubEnv("RESULTATS_SECRET", SECRET);

vi.mock("../../agenda/stockage", async () => {
  const { creerStockageFaux } = await import("../../agenda/stockage-faux");
  const faux = creerStockageFaux();
  return { commande: faux.commande, stockageConfigure: faux.stockageConfigure, __faux: faux };
});
vi.mock("../../dossier/base", () => ({ baseConfiguree: () => true, base: async () => ({}) }));
vi.mock("../../dossier/resultats", () => ({ recevoirResultat: vi.fn(async () => ({ id: 1 })) }));

import * as stockage from "../../agenda/stockage";
import * as resultats from "../../dossier/resultats";
import { POST } from "./route";

const faux = (stockage as unknown as { __faux: { donnees: Map<string, string> } }).__faux;

function requete(options: { secret?: string; horodatage?: number | null; ip?: string } = {}) {
  const f = new FormData();
  f.set("fichier", new File([new Uint8Array([37, 80, 68, 70])], "analyse.pdf", { type: "application/pdf" }));
  f.set("date", "2026-11-04");
  f.set("messageId", `message-${Math.random()}`);
  const headers: Record<string, string> = {
    authorization: `Bearer ${options.secret ?? SECRET}`,
    "x-forwarded-for": options.ip ?? "192.0.2.10",
  };
  if (options.horodatage !== null && options.horodatage !== undefined) headers["x-horodatage"] = String(options.horodatage);
  return new Request("http://localhost/api/resultats", { method: "POST", headers, body: f });
}
const maintenant = () => Math.floor(Date.now() / 1000);

describe("webhook des résultats d'analyses", () => {
  beforeEach(() => {
    faux.donnees.clear();
    vi.mocked(resultats.recevoirResultat).mockClear();
    vi.unstubAllEnvs();
    vi.stubEnv("RESULTATS_SECRET", SECRET);
  });

  it("un secret exact est accepté", async () => {
    expect((await POST(requete({ horodatage: maintenant() }))).status).toBe(200);
  });

  it("refuse le mauvais secret", async () => {
    expect((await POST(requete({ secret: "mauvais-secret-mauvais-secret-123" }))).status).toBe(401);
  });

  it("bloque une adresse qui essaie des secrets à la chaîne", async () => {
    const statuts: number[] = [];
    for (let i = 0; i < 30; i++) statuts.push((await POST(requete({ secret: `faux-secret-numero-${i}-0123456789` }))).status);
    expect(statuts).toContain(429);
    // Même avec le bon secret, l'adresse bloquée reste bloquée jusqu'à la fin de la fenêtre
    expect((await POST(requete())).status).toBe(429);
    expect(vi.mocked(resultats.recevoirResultat)).not.toHaveBeenCalled();
  });

  it("refuse un envoi rejoué trop tard (horodatage vieux de 10 minutes)", async () => {
    expect((await POST(requete({ horodatage: maintenant() - 600 }))).status).toBe(400);
    expect(vi.mocked(resultats.recevoirResultat)).not.toHaveBeenCalled();
  });

  it("horodatage obligatoire quand RESULTATS_HORODATAGE_OBLIGATOIRE=1", async () => {
    vi.stubEnv("RESULTATS_HORODATAGE_OBLIGATOIRE", "1");
    expect((await POST(requete({ horodatage: null }))).status).toBe(400);
    expect((await POST(requete({ horodatage: maintenant() }))).status).toBe(200);
  });
});

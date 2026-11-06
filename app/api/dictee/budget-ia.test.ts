import { beforeEach, describe, expect, it, vi } from "vitest";

// Porte « clé d'IA » : un compte (volé ou imprudent) ne doit pas pouvoir faire tourner l'IA sans fin à vos frais.
vi.mock("../../agenda/stockage", async () => {
  const { creerStockageFaux } = await import("../../agenda/stockage-faux");
  const faux = creerStockageFaux();
  return { commande: faux.commande, stockageConfigure: faux.stockageConfigure, __faux: faux };
});
vi.mock("../../agenda/session", () => ({
  utilisateurConnecte: async () => ({ identifiant: "remplacant", admin: false, role: "medecin" }),
  accesMedical: () => true,
}));
vi.mock("../../dossier/dictee", () => ({
  claudeConfigure: () => true,
  corriger: vi.fn(async () => ({ texte: "ok" })),
}));
vi.mock("../../dossier/redaction", () => ({ rediger: vi.fn(async () => ({})), typesRedaction: ["ett"] }));
vi.mock("../../dossier/questions", () => ({ resumeClinique: async () => null }));
vi.mock("../../dossier/lexique", () => ({ lireLexique: async () => [] }));
vi.mock("../../dossier/journal", () => ({ journaliser: async () => {} }));

import * as stockage from "../../agenda/stockage";
import * as dictee from "../../dossier/dictee";
import * as redaction from "../../dossier/redaction";
import { POST as correction } from "./correction/route";
import { POST as redactionRoute } from "./redaction/route";

const faux = (stockage as unknown as { __faux: { donnees: Map<string, string> } }).__faux;
const requete = (corps: unknown) =>
  new Request("http://localhost/api", { method: "POST", body: JSON.stringify(corps) });

describe("plafond d'utilisation de l'IA par compte", () => {
  beforeEach(() => {
    faux.donnees.clear();
    vi.mocked(dictee.corriger).mockClear();
    vi.mocked(redaction.rediger).mockClear();
  });

  it("la correction de dictée est plafonnée à 60 appels par heure et par compte", async () => {
    const statuts: number[] = [];
    for (let i = 0; i < 80; i++) statuts.push((await correction(requete({ texte: "dictée de test" }))).status);
    expect(vi.mocked(dictee.corriger).mock.calls.length).toBeLessThanOrEqual(60);
    expect(statuts.at(-1)).toBe(429);
  });

  it("la rédaction par Claude partage le même plafond", async () => {
    for (let i = 0; i < 40; i++) await correction(requete({ texte: "dictée de test" }));
    for (let i = 0; i < 40; i++) await redactionRoute(requete({ type: "ett", texte: "résultats de l'examen" }));
    const appels = vi.mocked(dictee.corriger).mock.calls.length + vi.mocked(redaction.rediger).mock.calls.length;
    expect(appels).toBeLessThanOrEqual(60);
  });
});

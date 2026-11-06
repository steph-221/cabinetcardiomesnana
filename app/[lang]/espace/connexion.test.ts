import { beforeEach, describe, expect, it, vi } from "vitest";

// Porte « limites » : les essais de connexion simultanés ne doivent pas contourner le compteur.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ refresh: () => {} }));
vi.mock("../../dossier/base", () => ({ baseConfiguree: () => false, base: async () => ({}) }));
vi.mock("../../agenda/stockage", async () => {
  const { creerStockageFaux } = await import("../../agenda/stockage-faux");
  const faux = creerStockageFaux();
  return { commande: faux.commande, stockageConfigure: faux.stockageConfigure, __faux: faux };
});
vi.mock("../../agenda/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../agenda/session")>()),
  verifierIdentifiants: vi.fn(async () => null),
}));

import * as stockage from "../../agenda/stockage";
import * as session from "../../agenda/session";
import { connexion } from "./actions";

const faux = (stockage as unknown as { __faux: { donnees: Map<string, string> } }).__faux;

const essai = (identifiant = "taouab") => {
  const f = new FormData();
  f.set("identifiant", identifiant);
  f.set("motDePasse", "mauvais-mot-de-passe");
  return connexion("fr", null, f);
};

describe("limite des essais de connexion", () => {
  beforeEach(() => {
    faux.donnees.clear();
    vi.mocked(session.verifierIdentifiants).mockClear();
    // La pause d'une seconde après un échec n'a pas à ralentir les tests
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as unknown as typeof setTimeout);
  });

  it("50 essais lancés en même temps : au plus 10 mots de passe sont réellement testés", async () => {
    await Promise.all(Array.from({ length: 50 }, () => essai()));
    expect(vi.mocked(session.verifierIdentifiants).mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("essais l'un après l'autre : verrouillé à partir du 11e", async () => {
    const reponses = [];
    for (let i = 0; i < 12; i++) reponses.push(await essai());
    expect(reponses[10]?.erreur).toMatch(/Trop d'essais/);
    expect(vi.mocked(session.verifierIdentifiants).mock.calls.length).toBe(10);
  });
});

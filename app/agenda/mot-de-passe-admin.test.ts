import { describe, expect, it } from "vitest";
import { evaluerCompteAdmin } from "./mot-de-passe-admin";

// Porte « connexion » : le mot de passe administrateur (variable Vercel) n'a aucune règle de longueur.
describe("mot de passe de l'administrateur", () => {
  it("signale un mot de passe trop court, sans jamais le révéler", () => {
    const r = evaluerCompteAdmin("taouab:court");
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("court");
  });
  it("accepte un mot de passe d'au moins 12 caractères", () => {
    expect(evaluerCompteAdmin("taouab:une-phrase-assez-longue").ok).toBe(true);
  });
  it("signale l'absence de compte administrateur ou un format invalide", () => {
    expect(evaluerCompteAdmin(undefined).ok).toBe(false);
    expect(evaluerCompteAdmin("sans-deux-points").ok).toBe(false);
  });
});

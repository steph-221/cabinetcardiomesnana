import { afterEach, describe, expect, it, vi } from "vitest";
import { lienRdv, signatureRdv, signatureValide } from "./lien-patient";
import { messageRappel, sujetRelance, texteRelance } from "./rappel";

afterEach(() => vi.unstubAllEnvs());

describe("lien personnel du patient", () => {
  it("signe l'identifiant du rendez-vous et refuse toute autre signature", () => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    const t = signatureRdv("abc123def456")!;
    expect(t).toHaveLength(32);
    expect(signatureValide("abc123def456", t)).toBe(true);
    expect(signatureValide("abc123def457", t)).toBe(false);
    expect(signatureValide("abc123def456", `${t.slice(0, -1)}A`)).toBe(false);
    expect(signatureValide("abc123def456", "")).toBe(false);
    expect(lienRdv("abc123def456", "https://exemple.test")).toBe(`https://exemple.test/fr/rendez-vous/gerer?r=abc123def456&t=${t}`);
  });
  it("ne crée aucun lien sans SESSION_SECRET valide", () => {
    vi.stubEnv("SESSION_SECRET", "trop court");
    expect(signatureRdv("abc")).toBeNull();
    expect(lienRdv("abc")).toBeNull();
    expect(signatureValide("abc", "n'importe quoi")).toBe(false);
  });
  it("change de signature quand le secret change", () => {
    vi.stubEnv("SESSION_SECRET", "a".repeat(40));
    const a = signatureRdv("abc");
    vi.stubEnv("SESSION_SECRET", "b".repeat(40));
    expect(signatureRdv("abc")).not.toBe(a);
  });
});

describe("rappel de rendez-vous", () => {
  const debut = new Date("2026-11-12T09:30:00Z");
  it("donne la date en français avec l'heure du cabinet et le lien", () => {
    const m = messageRappel({ prenom: "Salma", nom: "Alaoui", debut, medecin: "taouab", lien: "https://exemple.test/lien" });
    // L'heure dépend de la base des fuseaux du système (le Maroc change d'heure pendant le ramadan) : on vérifie la forme
    expect(m.sujet).toMatch(/^Rappel : votre rendez-vous du jeudi 12 novembre à \d{2}:\d{2}$/);
    expect(m.texte).toContain("Bonjour Salma ALAOUI,");
    expect(m.texte).toMatch(/jeudi 12 novembre à \d{2}:\d{2} \(Dr taouab\)/);
    expect(m.texte).toContain("https://exemple.test/lien");
  });
  it("renvoie vers le téléphone quand il n'y a pas de lien", () => {
    const m = messageRappel({ nom: "Alaoui", debut, lien: null });
    expect(m.texte).toContain("appelez le 05 39 31 85 50");
    expect(m.texte).not.toContain("http");
  });
});

describe("relance de suivi", () => {
  it("garde le texte WhatsApp existant", () => {
    const t = texteRelance({ nom: "Alaoui", sexe: "F", quoi: "Échocardiographie (ETT)", echeance: "2026-12-01" });
    expect(t).toContain("Bonjour Madame ALAOUI,");
    expect(t).toContain("(Échocardiographie (ETT)), prévu vers le 01/12/2026");
    expect(sujetRelance("INR")).toBe("Votre suivi au cabinet de cardiologie : INR");
  });
});

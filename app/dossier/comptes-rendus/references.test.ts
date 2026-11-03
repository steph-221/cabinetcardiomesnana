import { describe, expect, it } from "vitest";
import { blocReferences, promptRedaction } from "../prompts/redaction";
import { citationDansPassage } from "../verification-seuils";
import { avecSeuils } from "./references-propositions";
import { ajouterProposition, ligneReference, referencesCitees } from "./references";
import type { ReferenceSeuil } from "./seuils";

const ref = (r: Partial<ReferenceSeuil>): ReferenceSeuil => ({
  seuil: "mapa-seuils",
  verdict: "confirme",
  explication: "",
  citation: "24 h ≥ 130/80 mmHg",
  passageId: 7,
  sourceTitre: "ESC 2024 — Hypertension",
  page: 12,
  url: "https://exemple.org/doc.pdf",
  valide: "",
  validePar: "",
  commentaire: "",
  ...r,
});

describe("références d'un AU TOTAL", () => {
  it("ligne : document, page, phrase citée et état de validation", () => {
    expect(ligneReference("mapa-seuils", ref({}))).toBe("ESC 2024 — Hypertension, p. 12 : « 24 h ≥ 130/80 mmHg » (non validé)");
    expect(ligneReference("mapa-seuils", ref({ valide: "conforme", validePar: "Dr Test" }))).toContain("(validé par Dr Test)");
  });
  it("sans passage trouvé : la source citée par l'application, signalée comme non validée", () => {
    const l = ligneReference("mapa-seuils", null);
    expect(l).toContain("ESC/ESH 2018 (MAPA)");
    expect(l).toContain("non retrouvé");
    expect(l).toContain("non validé");
  });
  it("une référence refusée ou sans citation n'est jamais présentée comme validée", () => {
    expect(ligneReference("mapa-seuils", ref({ citation: null, sourceTitre: null }))).toContain("non validé");
  });
  it("numérote les repères dans l'ordre d'ajout et réutilise le numéro d'une règle déjà citée", () => {
    const a = ajouterProposition("", [], { texte: "HTA masquée.", seuils: ["mapa-seuils", "mapa-consultation"] });
    expect(a.total).toBe("HTA masquée. [1, 2]");
    const b = ajouterProposition(a.total, a.utilisees, { texte: "Profil dipper.", seuils: ["mapa-profil"] });
    expect(b.total).toBe("HTA masquée. [1, 2]\nProfil dipper. [3]");
    const c = ajouterProposition(b.total, b.utilisees, { texte: "PA nocturne élevée.", seuils: ["mapa-seuils"] });
    expect(c.total.endsWith("PA nocturne élevée. [1]")).toBe(true);
    expect(c.utilisees).toEqual(["mapa-seuils", "mapa-consultation", "mapa-profil"]);
  });
  it("une proposition sans référence n'a pas de repère", () => {
    expect(ajouterProposition("", [], { texte: "Dominance droite.", seuils: [] }).total).toBe("Dominance droite.");
  });
  it("les références ne gardent que les repères encore présents dans le texte", () => {
    const refs = { "mapa-seuils": ref({}), "mapa-profil": ref({ seuil: "mapa-profil", citation: "dipper : 10 à 20 %", page: 14 }) };
    const utilisees = ["mapa-seuils", "mapa-consultation", "mapa-profil"];
    const lignes = referencesCitees("HTA masquée. [1, 3]", utilisees, refs);
    expect(lignes).toHaveLength(2);
    expect(lignes[0].startsWith("[1] ESC 2024")).toBe(true);
    expect(lignes[1].startsWith("[3] ESC 2024")).toBe(true);
    expect(referencesCitees("Texte sans repère.", utilisees, refs)).toEqual([]);
  });
});

describe("références des propositions", () => {
  it("une proposition appuyée sur une recommandation renvoie à sa règle ; une saisie simple n'en a pas", () => {
    const [a, b] = avecSeuils("mapa", [
      { texte: "HTA masquée (PA de consultation normale, MAPA élevée).", source: "ESC/ESH 2018 (MAPA)" },
      { texte: "Qualité médiocre.", source: "Critère usuel" },
    ]);
    expect(a.seuils).toEqual(["mapa-seuils", "mapa-consultation"]);
    expect(b.seuils).toEqual([]);
  });
});

describe("vérification d'une citation", () => {
  const passage = "La MAPA des 24 h\nconfirme l'hypertension si la moyenne  est ≥ 130/80 mmHg.";
  it("retrouve la phrase aux espaces et retours à la ligne près", () => {
    expect(citationDansPassage(passage, "confirme l'hypertension si la moyenne est ≥ 130/80 mmHg")).toBe(true);
  });
  it("refuse une phrase inventée, modifiée ou vide", () => {
    expect(citationDansPassage(passage, "confirme l'hypertension si la moyenne est ≥ 135/85 mmHg")).toBe(false);
    expect(citationDansPassage(passage, "")).toBe(false);
  });
});

describe("références du prompt de rédaction", () => {
  it("chaque extrait porte un repère R1, R2… et le prompt demande de les citer", () => {
    const bloc = blocReferences([
      { titre: "ESC 2024", page: 12, texte: "a" },
      { titre: "HAS", texte: "b" },
    ]);
    expect(bloc).toContain('<reference id="R1" titre="ESC 2024 — p. 12">');
    expect(bloc).toContain('<reference id="R2" titre="HAS">');
    const prompt = promptRedaction({ medecin: "Dr Test", ville: "Tanger" });
    expect(prompt).toContain("repère entre crochets");
    expect(prompt).toContain("n'invente aucune référence");
  });
});

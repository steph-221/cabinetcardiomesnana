import { describe, expect, it } from "vitest";
import { comparerNoms, estCopie, genreDepuisNom, regrouper, type Element } from "./regroupement";
import type { IdentiteLue } from "./reprise";

const id = (nom: string, prenom: string, extra: Partial<IdentiteLue> = {}): IdentiteLue => ({
  nom,
  prenom,
  naissance: null,
  age: null,
  dateDocument: null,
  ...extra,
});
const el = (n: number, nomFichier: string, identite: IdentiteLue): Element => ({ id: n, nomFichier, identite });

describe("comparerNoms", () => {
  it("ignore l'ordre, la casse et les accents", () => {
    expect(comparerNoms(id("Berrada", "Nabil"), id("Nabil", "BERRADA"))).toBe("identique");
  });
  it("repère une faute de frappe", () => {
    expect(comparerNoms(id("Chakri", "Mounir"), id("Chakiri", "Mounir"))).toBe("probable");
    expect(comparerNoms(id("Lamrani", "Salma"), id("Lamrani", "Salmo"))).toBe("probable");
  });
  it("ne mélange pas deux membres d'une même famille", () => {
    expect(comparerNoms(id("Tahiri", "Youssef"), id("Tahiri", "Rahma"))).toBe("different");
    expect(comparerNoms(id("Berrada", "Karim"), id("Said", "Berrada"))).toBe("different");
  });
});

describe("regrouper", () => {
  it("réunit les visites d'un même patient et signale les fautes de frappe", () => {
    const g = regrouper([
      el(1, "chakiri mounir cst.docx", id("Chakiri", "Mounir")),
      el(2, "chakri mounir ett.docx", id("Chakri", "Mounir")),
      el(3, "tahiri youssef.docx", id("Tahiri", "Youssef")),
      el(4, "tahiri rahma.docx", id("Tahiri", "Rahma")),
    ]);
    expect(g.map((x) => x.elements.map((e) => e.id))).toEqual([[1, 2], [3], [4]]);
    expect(g[0].certitude).toBe("probable");
  });
  it("sépare deux homonymes dont les dates de naissance ou les âges diffèrent", () => {
    const g = regrouper([
      el(1, "a.docx", id("Alami", "Samir", { naissance: "1960-01-02" })),
      el(2, "b.docx", id("Alami", "Samir", { naissance: "1985-05-05" })),
      el(3, "c.docx", id("Alami", "Samir", { age: 30 })),
    ]);
    // 3 est compatible avec 1 et 2 (âge seul) : il rejoint le premier 
    expect(g.map((x) => x.elements.map((e) => e.id))).toEqual([[1, 3], [2]]);
  });
});

describe("nom de fichier", () => {
  it("repère les modèles vierges", () => {
    expect(genreDepuisNom("FICHE CS VIERGE.docx")).toBe("modele_vierge");
    expect(genreDepuisNom("Consultation Dr Taouab Date (1).docx")).toBe("modele_vierge");
  });
  it("devine le genre de document", () => {
    expect(genreDepuisNom("LAILA IDRISSI  ETT 3.docx")).toBe("ett");
    expect(genreDepuisNom("bennis aicha thrombose.docx")).toBe("ett");
    expect(genreDepuisNom("karim alaoui cst (2).docx")).toBe("consultation");
    expect(genreDepuisNom("el fassi omar préop.docx")).toBe("consultation");
    expect(genreDepuisNom("amina el idrissi cs (1).docx")).toBe("consultation");
    expect(genreDepuisNom("salmi nadia0001.jpg")).toBe("inconnu");
  });
  it("repère les copies", () => {
    expect(estCopie("tazi-maroc (1).jpg")).toBe(true);
    expect(estCopie("oulad nour.docx 2.docx")).toBe(true);
    expect(estCopie("amrani sara2.docx")).toBe(true);
    expect(estCopie("berrada karim ett.docx")).toBe(false);
  });
});

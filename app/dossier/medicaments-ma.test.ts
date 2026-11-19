import { describe, expect, it } from "vitest";
import { chercherMedicaments } from "./medicaments-ma";

describe("recherche medicament.ma", () => {
  it("trouve par nom commercial, avec lien vers la fiche", async () => {
    const r = await chercherMedicaments("bisoprolol");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].url).toMatch(/^https:\/\/medicament\.ma\/medicament\//);
    expect(r[0].dci).toBeTruthy();
  });
  it("trouve par substance et ignore accents et casse", async () => {
    const r = await chercherMedicaments("RIVAROXABAN 20");
    expect(r.some((m) => /rivaroxaban/i.test(m.dci))).toBe(true);
  });
  it("ignore les saisies trop courtes", async () => {
    expect(await chercherMedicaments("a")).toEqual([]);
  });
});

import { formeDe, prixDe, rechercherMedicaments } from "./medicaments-ma";

describe("filtres de recherche", () => {
  it("filtre par famille, générique et prix", async () => {
    const { resultats, total } = await rechercherMedicaments({ famille: "statine", type: "generique", prixMax: 100, tri: "prix" });
    expect(total).toBeGreaterThan(0);
    expect(resultats.every((m) => m.familles.includes("statine") && m.generique && (m.prix ?? 0) <= 100)).toBe(true);
    const prix = resultats.map((m) => m.prix ?? 0);
    expect(prix).toEqual([...prix].sort((a, b) => a - b));
  });
  it("une situation clinique regroupe plusieurs familles", async () => {
    const { resultats } = await rechercherMedicaments({ situation: "fa-anticoag" }, 200);
    const familles = new Set(resultats.flatMap((m) => m.familles));
    expect(familles.has("aod")).toBe(true);
  });
  it("combine texte et forme", async () => {
    const { resultats } = await rechercherMedicaments({ q: "amlodipine", forme: "comprimé" });
    expect(resultats.length).toBeGreaterThan(0);
    expect(resultats.every((m) => m.forme === "comprimé")).toBe(true);
  });
  it("reconnaît la forme et le prix", () => {
    expect(formeDe("ABC 5 MG, Comprimé pelliculé [P]")).toBe("comprimé");
    expect(formeDe("XYZ, Solution injectable")).toBe("injectable");
    expect(prixDe("89.00 dhs")).toBe(89);
    expect(prixDe("")).toBeNull();
  });
});

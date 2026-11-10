import { describe, expect, it } from "vitest";
import { espaces, espacesVisibles, pageDe } from "./navigation";

describe("espaces de l'espace cabinet", () => {
  it("garde les 13 pages d'avant, chacune une seule fois, et ajoute Ma journée, À valider et Modèles IA", () => {
    const chemins = espaces.flatMap((e) => e.pages.map((p) => p.chemin));
    expect(new Set(chemins).size).toBe(chemins.length);
    for (const avant of ["", "/patients", "/suivis", "/comptabilite", "/lexique", "/assistant", "/calculateurs", "/bibliotheque", "/resultats", "/reprise", "/drive", "/journal", "/comptes"]) {
      expect(chemins, avant).toContain(avant);
    }
    expect(chemins).toEqual(expect.arrayContaining(["/aujourdhui", "/a-valider", "/messages", "/rappels", "/population", "/modeles-ia"]));
  });

  it("montre à la secrétaire ni le savoir médical, ni la reprise Word, ni l'administration", () => {
    const pages = espacesVisibles({ medical: false, admin: false }).flatMap((e) => e.pages.map((p) => p.cle));
    expect(pages).toEqual(["journee", "a-valider", "messages", "rappels", "suivis", "resultats", "patients", "agenda", "comptabilite"]);
    expect(espacesVisibles({ medical: false, admin: false }).map((e) => e.cle)).not.toContain("savoir");
  });

  it("montre au médecin le savoir et la reprise, mais pas l'administration", () => {
    const pages = espacesVisibles({ medical: true, admin: false }).flatMap((e) => e.pages.map((p) => p.cle));
    expect(pages).toEqual(expect.arrayContaining(["assistant", "bibliotheque", "reprise"]));
    expect(pages).not.toContain("comptes");
    expect(pages).not.toContain("modeles-ia");
  });

  it("montre tout à l'administrateur", () => {
    expect(espacesVisibles({ medical: true, admin: true }).flatMap((e) => e.pages)).toHaveLength(espaces.flatMap((e) => e.pages).length);
  });
});

describe("page allumée d'après le chemin", () => {
  const cle = (p: string) => pageDe(p)?.page.cle;
  it("reconnaît pages et sous-pages", () => {
    expect(cle("/fr/espace")).toBe("agenda");
    expect(cle("/fr/espace/patients/12/consultation")).toBe("patients");
    expect(cle("/fr/espace/bibliotheque/theme/fa")).toBe("bibliotheque");
    expect(cle("/fr/espace/comptabilite/factures/3")).toBe("comptabilite");
    expect(cle("/fr/espace/aujourdhui")).toBe("journee");
    expect(pageDe("/fr/espace/suivis")?.espace.cle).toBe("aujourdhui");
    expect(pageDe("/fr/espace/lexique")?.espace.cle).toBe("savoir");
  });
  it("n'allume rien sur la page de connexion", () => {
    expect(pageDe("/fr/espace/connexion")).toBeNull();
  });
});

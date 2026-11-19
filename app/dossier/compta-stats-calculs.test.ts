import { describe, expect, it } from "vitest";
import {
  ajouterJours,
  ajouterMois,
  cleSeau,
  echelle,
  ecartJours,
  estDate,
  granulariteEffective,
  lirePeriode,
  lundi,
  matrice,
  periodeDuRaccourci,
  periodePrecedente,
  repereCourt,
  seaux,
  variation,
} from "./compta-stats-calculs";

describe("dates", () => {
  it("refuse les dates qui n'existent pas", () => {
    expect(estDate("2026-06-30")).toBe(true);
    for (const mauvaise of ["2026-06-31", "2026-02-30", "2026-13-01", "26-01-01", "", "2026-1-1"]) {
      expect(estDate(mauvaise)).toBe(false);
    }
  });
  it("ajoute des jours et des mois, fins de mois comprises", () => {
    expect(ajouterJours("2026-02-27", 3)).toBe("2026-03-02");
    expect(ajouterMois("2026-11-15", 3)).toBe("2027-02-01");
    expect(ajouterMois("2026-01-31", -1)).toBe("2025-12-01");
    expect(ecartJours("2026-01-01", "2026-12-31")).toBe(364);
  });
  it("trouve le lundi de la semaine", () => {
    expect(lundi("2026-11-04")).toBe("2026-11-02"); // mercredi
    expect(lundi("2026-11-02")).toBe("2026-11-02"); // déjà lundi
    expect(lundi("2026-11-08")).toBe("2026-11-02"); // dimanche
    expect(lundi("2026-01-01")).toBe("2025-12-29"); // à cheval sur l'année
  });
});

describe("périodes", () => {
  const aujourdhui = "2026-11-04";
  it("raccourcis", () => {
    expect(periodeDuRaccourci("mois", aujourdhui)).toMatchObject({ du: "2026-11-01", au: "2026-11-04" });
    expect(periodeDuRaccourci("mois-dernier", aujourdhui)).toMatchObject({ du: "2026-10-01", au: "2026-10-31" });
    expect(periodeDuRaccourci("3mois", aujourdhui)).toMatchObject({ du: "2026-09-01", au: aujourdhui });
    expect(periodeDuRaccourci("12mois", aujourdhui)).toMatchObject({ du: "2025-12-01", au: aujourdhui });
    expect(periodeDuRaccourci("annee", aujourdhui)).toMatchObject({ du: "2026-01-01", au: aujourdhui });
    expect(periodeDuRaccourci("annee-derniere", aujourdhui)).toMatchObject({ du: "2025-01-01", au: "2025-12-31" });
    expect(periodeDuRaccourci("tout", aujourdhui)).toMatchObject({ du: null, au: aujourdhui });
  });
  it("mois dernier en janvier remonte à décembre", () => {
    expect(periodeDuRaccourci("mois-dernier", "2026-01-15")).toMatchObject({ du: "2025-12-01", au: "2025-12-31" });
  });
  it("dates libres : remises dans l'ordre, invalides ignorées", () => {
    expect(lirePeriode({ du: "2026-03-01", au: "2026-03-31" }, aujourdhui)).toEqual({ du: "2026-03-01", au: "2026-03-31", raccourci: null });
    expect(lirePeriode({ du: "2026-03-31", au: "2026-03-01" }, aujourdhui)).toMatchObject({ du: "2026-03-01", au: "2026-03-31" });
    expect(lirePeriode({ du: "2026-06-31", au: "2026-07-01" }, aujourdhui).raccourci).toBe("annee"); // date impossible
    expect(lirePeriode({ p: "nimporte" }, aujourdhui).raccourci).toBe("annee");
    expect(lirePeriode({ p: "mois" }, aujourdhui).raccourci).toBe("mois");
    expect(lirePeriode({}, aujourdhui).raccourci).toBe("annee");
  });
  it("limite la durée à 10 ans", () => {
    const p = lirePeriode({ du: "1990-01-01", au: "2026-01-01" }, aujourdhui);
    expect(ecartJours(p.du!, p.au)).toBe(3660);
  });
  it("période précédente de même durée", () => {
    expect(periodePrecedente("2026-11-01", "2026-11-30")).toEqual({ du: "2026-10-02", au: "2026-10-31" });
    expect(periodePrecedente("2026-11-04", "2026-11-04")).toEqual({ du: "2026-11-03", au: "2026-11-03" });
  });
});

describe("regroupement", () => {
  it("choisit seul le bon regroupement", () => {
    expect(granulariteEffective(null, "2026-11-01", "2026-11-04")).toBe("jour");
    expect(granulariteEffective(null, "2026-09-01", "2026-11-04")).toBe("semaine");
    expect(granulariteEffective(null, "2026-01-01", "2026-11-04")).toBe("mois");
  });
  it("respecte le choix, sauf s'il rendrait le graphique illisible", () => {
    expect(granulariteEffective("mois", "2026-11-01", "2026-11-04")).toBe("mois");
    expect(granulariteEffective("jour", "2026-01-01", "2026-04-30")).toBe("semaine"); // 120 jours > 92
    expect(granulariteEffective("jour", "2025-01-01", "2026-11-04")).toBe("mois");
    expect(granulariteEffective("semaine", "2020-01-01", "2026-11-04")).toBe("mois");
  });
  it("un seau par mois, sans trou, avec l'année sous janvier", () => {
    const liste = seaux("2025-11-15", "2026-02-10", "mois");
    expect(liste.map((s) => s.cle)).toEqual(["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]);
    expect(liste.map((s) => s.annee)).toEqual(["2025", null, "2026", null]);
    expect(liste[0].long).toBe("novembre 2025");
  });
  it("seaux par semaine : du lundi, dont la semaine qui contient le début", () => {
    const liste = seaux("2026-11-04", "2026-11-17", "semaine");
    expect(liste.map((s) => s.cle)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(liste[0].long).toBe("Semaine du 2 novembre 2026");
  });
  it("seaux par jour", () => {
    const liste = seaux("2026-02-27", "2026-03-02", "jour");
    expect(liste.map((s) => s.cle)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(liste[0].long).toBe("vendredi 27 février 2026");
    expect(liste[2].long).toBe("dimanche 1er mars 2026");
  });
  it("une date tombe dans le seau que la base lui donnerait", () => {
    expect(cleSeau("2026-11-04", "mois")).toBe("2026-11-01");
    expect(cleSeau("2026-11-04", "semaine")).toBe("2026-11-02");
    expect(cleSeau("2026-11-04", "jour")).toBe("2026-11-04");
  });
});

describe("matrice", () => {
  it("place les valeurs, cumule les doublons et ignore l'inconnu", () => {
    const liste = seaux("2026-01-01", "2026-03-31", "mois");
    const m = matrice(liste, ["1", "2"], [
      { cle: "2026-01-01", serie: "1", valeur: 10 },
      { cle: "2026-01-01", serie: "1", valeur: 5 },
      { cle: "2026-03-01", serie: "2", valeur: 7 },
      { cle: "2027-01-01", serie: "1", valeur: 99 }, // hors période
      { cle: "2026-02-01", serie: "9", valeur: 99 }, // série inconnue
    ]);
    expect(m).toEqual([
      [15, 0],
      [0, 0],
      [0, 7],
    ]);
  });
});

describe("variation", () => {
  it("pourcentage et sens", () => {
    expect(variation(150, 100)).toEqual({ pourcent: 50, sens: "hausse" });
    expect(variation(75, 100)).toEqual({ pourcent: -25, sens: "baisse" });
    expect(variation(100, 100)).toEqual({ pourcent: 0, sens: "stable" });
  });
  it("rien à comparer quand la période précédente est vide", () => {
    expect(variation(100, 0)).toBeNull();
    expect(variation(0, 0)).toBeNull();
  });
});

describe("échelle", () => {
  it("repères ronds qui couvrent le maximum", () => {
    expect(echelle(0)).toEqual({ haut: 1, reperes: [0, 1] });
    expect(echelle(87)).toEqual({ haut: 100, reperes: [0, 25, 50, 75, 100] });
    expect(echelle(1234)).toEqual({ haut: 1500, reperes: [0, 500, 1000, 1500] });
    const e = echelle(653590);
    expect(e.haut).toBeGreaterThanOrEqual(653590);
    expect(e.reperes[0]).toBe(0);
    expect(e.reperes.at(-1)).toBe(e.haut);
  });
  it("un seul style par axe", () => {
    expect(repereCourt(0, false).replace(/\s/g, "")).toBe("0");
    expect(repereCourt(2500, false).replace(/\s/g, "")).toBe("2500");
    expect(repereCourt(20000, true).replace(/\s/g, "")).toBe("20k");
    expect(repereCourt(2500, true).replace(/\s/g, "")).toBe("2,5k");
    expect(repereCourt(0, true)).toBe("0"); // pas de « 0 k »
  });
});

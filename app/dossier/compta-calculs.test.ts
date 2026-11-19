import { describe, expect, it } from "vitest";
import {
  bornes,
  enLettres,
  lireMontant,
  montant,
  montantEnLettres,
  partager,
  periodeVoisine,
  repartir,
  statutFacture,
  totalFacture,
} from "./compta-calculs";

describe("montants", () => {
  it("lit les saisies courantes", () => {
    expect(lireMontant("300")).toBe(30000);
    expect(lireMontant("300,5")).toBe(30050);
    expect(lireMontant("1 200.50")).toBe(120050);
    expect(lireMontant("0")).toBe(0);
  });
  it("refuse le reste", () => {
    for (const mauvais of ["", "abc", "-5", "3,456", "1e3", "12,"]) expect(lireMontant(mauvais)).toBeNull();
  });
  it("formate", () => {
    expect(montant(30050)).toBe("300,50");
    expect(montant(30000, true)).toBe("300");
    expect(montant(120000)).toBe("1 200,00");
  });
});

describe("facture", () => {
  const lignes = [
    { libelle: "Consultation", quantite: 1, prixCts: 30000 },
    { libelle: "ECG", quantite: 2, prixCts: 15050 },
  ];
  it("total avec remise, jamais négatif", () => {
    expect(totalFacture(lignes, 0)).toBe(60100);
    expect(totalFacture(lignes, 10000)).toBe(50100);
    expect(totalFacture(lignes, 999999)).toBe(0);
  });
  it("statut", () => {
    expect(statutFacture({ annulee: true, totalCts: 100, payeCts: 100 })).toBe("annulee");
    expect(statutFacture({ annulee: false, totalCts: 100, payeCts: 0 })).toBe("impayee");
    expect(statutFacture({ annulee: false, totalCts: 100, payeCts: 40 })).toBe("partielle");
    expect(statutFacture({ annulee: false, totalCts: 100, payeCts: 100 })).toBe("payee");
    expect(statutFacture({ annulee: false, totalCts: 0, payeCts: 0 })).toBe("payee");
  });
});

describe("partage", () => {
  it("la somme des parts est toujours exacte", () => {
    for (const [m, poids] of [
      [100001, [50, 50]],
      [10000, [1, 1, 1]],
      [1, [50, 50]],
      [123457, [60, 40]],
    ] as [number, number[]][]) {
      const parts = partager(m, poids);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(m);
    }
  });
  it("proportionnel", () => {
    expect(partager(10000, [60, 40])).toEqual([6000, 4000]);
  });
  it("sans poids : tout au premier", () => {
    expect(partager(500, [0, 0])).toEqual([500, 0]);
  });
});

describe("répartition entre médecins", () => {
  const medecins = [
    { id: 1, nom: "A", part: 50 },
    { id: 2, nom: "B", part: 50 },
  ];
  it("chacun garde ses honoraires et paie la moitié des charges communes", () => {
    const r = repartir(medecins, new Map([[1, 100000], [2, 60000]]), 40000, new Map([[2, 5000]]), false);
    expect(r[0]).toMatchObject({ recettes: 100000, chargesCommunes: 20000, resultat: 80000 });
    expect(r[1]).toMatchObject({ recettes: 60000, chargesCommunes: 20000, chargesPerso: 5000, resultat: 35000 });
  });
  it("mis en commun : le pot est partagé selon les parts", () => {
    const r = repartir(medecins, new Map([[1, 100000], [2, 60000]]), 40000, new Map(), true);
    expect(r[0].recettes).toBe(80000);
    expect(r[1].recettes).toBe(80000);
    expect(r[0].resultat + r[1].resultat).toBe(160000 - 40000);
  });
});

describe("périodes", () => {
  it("bornes d'un mois et d'une année", () => {
    expect(bornes("2026-02")).toEqual({ du: "2026-02-01", au: "2026-02-28" });
    expect(bornes("2028-02").au).toBe("2028-02-29");
    expect(bornes("2026")).toEqual({ du: "2026-01-01", au: "2026-12-31" });
  });
  it("mois voisins", () => {
    expect(periodeVoisine("2026-12", 1)).toBe("2027-01");
    expect(periodeVoisine("2026-01", -1)).toBe("2025-12");
    expect(periodeVoisine("2026", 1)).toBe("2027");
  });
});

describe("montant en lettres", () => {
  it.each([
    [0, "zéro"],
    [21, "vingt et un"],
    [71, "soixante et onze"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [91, "quatre-vingt-onze"],
    [200, "deux cents"],
    [201, "deux cent un"],
    [300, "trois cents"],
    [1000, "mille"],
    [1234, "mille deux cent trente-quatre"],
    [80000, "quatre-vingt mille"],
    [200000, "deux cent mille"],
    [2_000_000, "deux millions"],
  ])("%i", (n, texte) => expect(enLettres(n)).toBe(texte));

  it("dirhams et centimes", () => {
    expect(montantEnLettres(30000)).toBe("trois cents dirhams");
    expect(montantEnLettres(100)).toBe("un dirham");
    expect(montantEnLettres(30050)).toBe("trois cents dirhams et cinquante centimes");
  });
});

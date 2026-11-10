import { describe, expect, it } from "vitest";
import { actesProposes, lireActesDemandes } from "./proposition-facture";
import { verifierOrdonnance } from "./securite-prescription";

const actes = [
  { id: 1, libelle: "Consultation de cardiologie" },
  { id: 2, libelle: "Consultation de contrôle" },
  { id: 3, libelle: "Électrocardiogramme (ECG)" },
  { id: 4, libelle: "Échocardiographie (ETT)" },
  { id: 5, libelle: "Holter ECG 24 h" },
  { id: 6, libelle: "Holter tensionnel (MAPA)" },
  { id: 7, libelle: "Épreuve d'effort" },
];

describe("facture proposée", () => {
  it("propose la consultation puis un acte par examen du jour", () => {
    expect(actesProposes(actes, [])).toEqual([1]);
    expect(actesProposes(actes, ["ECG", "Échocardiographie (ETT)"])).toEqual([1, 3, 4]);
    expect(actesProposes(actes, ["Holter ECG", "MAPA", "Épreuve d'effort"])).toEqual([1, 5, 6, 7]);
  });
  it("ne propose pas deux fois le même acte et ignore les examens sans tarif", () => {
    expect(actesProposes(actes, ["ECG", "ECG", "Biologie", "Coroscanner"])).toEqual([1, 3]);
  });
  it("préfère le contrôle quand c'en est un, sinon la consultation", () => {
    expect(actesProposes(actes, [], true)).toEqual([2]);
    expect(actesProposes(actes.filter((a) => a.id !== 2), [], true)).toEqual([1]);
    expect(actesProposes([{ id: 9, libelle: "Autre" }], ["ECG"])).toEqual([]);
  });
  it("lit les actes demandés dans l'adresse, sans identifiant inconnu ni doublon", () => {
    expect(lireActesDemandes("1,4,4,99,x", actes)).toEqual([1, 4]);
    expect(lireActesDemandes(["3"], actes)).toEqual([3]);
    expect(lireActesDemandes(undefined, actes)).toEqual([]);
  });
});

describe("sécurité de prescription", () => {
  const v = (lignes: string[], allergies = "") => verifierOrdonnance(lignes.map((medicament) => ({ medicament })), allergies);

  it("ne dit rien d'une ordonnance sans problème", () => {
    expect(v(["Bisoprolol 5 mg", "Atorvastatine 40 mg", "Kardégic 75 mg"])).toEqual([]);
  });
  it("signale une allergie notée au dossier", () => {
    const r = v(["Amoxicilline 1 g", "Bisoprolol 5 mg"], "pénicilline");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ niveau: "critique", lignes: [0] });
    // « Kardégic » est de l'aspirine : retrouvé même sans sa DCI
    expect(v(["Kardégic 75 mg"], "allergie à l'aspirine")[0]?.niveau).toBe("critique")
    expect(v(["Bisoprolol 5 mg"], "allergie à l'aspirine")).toEqual([]);
    const allergie = verifierOrdonnance([{ medicament: "Kardégic 75 mg", dci: "acide acetylsalicylique" }], "allergie à l'aspirine");
    expect(allergie[0]?.niveau).toBe("critique");
    expect(allergie[0]?.lignes).toEqual([0]);
  });
  it("signale le même médicament deux fois", () => {
    const r = v(["Bisoprolol 5 mg", "bisoprolol 2,5 mg"]);
    expect(r.map((x) => x.texte).join(" ")).toMatch(/figure déjà/);
  });
  it("signale deux médicaments de la même famille, mais pas aspirine + clopidogrel voulus", () => {
    expect(v(["Ramipril 5 mg", "Périndopril 5 mg"]).map((x) => x.texte).join(" ")).toMatch(/même famille/);
    expect(v(["Kardégic 75 mg acide acetylsalicylique", "Clopidogrel 75 mg"]).map((x) => x.texte).join(" ")).not.toMatch(/même famille/);
  });
  it("signale les associations dangereuses, les plus graves d'abord", () => {
    const r = v(["Bisoprolol 5 mg", "Diltiazem 90 mg", "Ramipril 5 mg", "Valsartan 80 mg"]);
    expect(r[0].niveau).toBe("critique");
    expect(r.map((x) => x.texte).join(" ")).toMatch(/diltiazem ou vérapamil/);
    expect(r.map((x) => x.texte).join(" ")).toMatch(/IEC et ARA II/);
  });
});

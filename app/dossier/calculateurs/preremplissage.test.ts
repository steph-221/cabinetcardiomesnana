import { describe, expect, it } from "vitest";
import { calculateurs, trouverCalculateur } from "./index";
import { preremplir, type DonneesDossier } from "./preremplissage";

const dossier: DonneesDossier = {
  age: 78,
  sexe: "F",
  poids: 62,
  taille: 165,
  fc: 72,
  creatinine: 11,
  facteurs: ["HTA", "Tabac"],
  tabac: "actuel",
  alcoolVerres: 10,
  fevg: 52,
};

describe("preremplir", () => {
  it("reprend l'âge, la tranche d'âge, le sexe et les facteurs de risque du dossier", () => {
    const calc = trouverCalculateur("cha2ds2-vasc")!;
    const { valeurs, origines } = preremplir(calc, dossier);
    expect(valeurs.age).toBe("2");
    expect(valeurs.femme).toBe(true);
    expect(valeurs.hta).toBe(true);
    expect(valeurs.diabete).toBeUndefined();
    expect(origines.age).toBe("âge du dossier");
    expect(origines.femme).toBe("sexe du dossier");
  });

  it("reprend les mesures de consultation pour le DFG et l'IMC", () => {
    const { valeurs } = preremplir(trouverCalculateur("dfg-ckd-epi")!, dossier);
    expect(valeurs.creatinine).toBe(11);
    expect(valeurs.age).toBe(78);
    expect(valeurs.sexe).toBe("F");
    const imc = preremplir(trouverCalculateur("imc-surface")!, dossier).valeurs;
    expect(imc.poids).toBe(62);
    expect(imc.taille).toBe(165);
  });

  it("indique d'où viennent poids et taille (fiche patient ou dernière consultation)", () => {
    const { origines } = preremplir(trouverCalculateur("imc-surface")!, { ...dossier, poidsOrigine: "fiche patient" });
    expect(origines.poids).toBe("fiche patient");
    expect(origines.taille).toBe("dernière consultation");
  });

  it("ne reprend pas une valeur absente du dossier", () => {
    const { valeurs } = preremplir(trouverCalculateur("dfg-ckd-epi")!, { ...dossier, creatinine: null });
    expect("creatinine" in valeurs).toBe(false);
  });

  it("n'invente rien pour un calcul sans correspondance dans le dossier", () => {
    const { valeurs, origines } = preremplir(trouverCalculateur("wells-tvp")!, dossier);
    expect(Object.keys(valeurs)).toEqual([]);
    expect(origines).toEqual({});
  });

  it("applique le seuil d'âge propre à chaque score (HAS-BLED : strictement plus de 65 ans)", () => {
    const hasBled = trouverCalculateur("has-bled")!;
    expect(preremplir(hasBled, { ...dossier, age: 65 }).valeurs.age).toBeUndefined();
    expect(preremplir(hasBled, { ...dossier, age: 66 }).valeurs.age).toBe(true);
  });

  it("tous les calculateurs acceptent le pré-remplissage sans erreur", () => {
    for (const c of calculateurs) expect(() => preremplir(c, dossier)).not.toThrow();
  });

  it("reprend le tabagisme actuel, l'alcool à partir de 8 verres par semaine et la FEVG", () => {
    const hfa = preremplir(trouverCalculateur("hfa-icos-her2")!, { ...dossier, fevgOrigine: "FEVG de base de la fiche" });
    expect(hfa.valeurs.tabac).toBe(true);
    expect(hfa.origines.tabac).toBe("tabagisme de la fiche");
    expect(hfa.valeurs.fevg).toBe("limite");
    expect(hfa.origines.fevg).toBe("FEVG de base de la fiche");
    const hasBled = preremplir(trouverCalculateur("has-bled")!, dossier);
    expect(hasBled.valeurs.alcool).toBe(true);
    expect(preremplir(trouverCalculateur("has-bled")!, { ...dossier, alcoolVerres: 7 }).valeurs.alcool).toBeUndefined();
  });

  it("un ancien fumeur n'est pas repris comme fumeur actuel", () => {
    const v = preremplir(trouverCalculateur("hfa-icos-her2")!, { ...dossier, tabac: "ancien", facteurs: [] }).valeurs;
    expect(v.tabac).toBeUndefined();
  });

  it("tranches de FEVG : 55 et plus normale, 50 à 54 limite, moins de 50 basse", () => {
    const hfa = trouverCalculateur("hfa-icos-her2")!;
    expect(preremplir(hfa, { ...dossier, fevg: 60 }).valeurs.fevg).toBe("normale");
    expect(preremplir(hfa, { ...dossier, fevg: 50 }).valeurs.fevg).toBe("limite");
    expect(preremplir(hfa, { ...dossier, fevg: 49 }).valeurs.fevg).toBe("basse");
  });
});

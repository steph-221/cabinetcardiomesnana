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
});

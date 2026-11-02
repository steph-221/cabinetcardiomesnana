import { describe, expect, it } from "vitest";
import { cha2ds2va } from "../calculs";
import { cha2ds2vaCalculateur } from "./definitions/cha2ds2va";
import { hfaIcosHer2 } from "./definitions/hfa-icos-her2";

const hfa = (valeurs: Record<string, boolean | string>) => hfaIcosHer2.evaluer(valeurs);

describe("HFA-ICOS anti-HER2", () => {
  it("aucun facteur : risque faible", () => {
    expect(hfa({})).toMatchObject({ score: 0, libelle: "Risque faible" });
  });
  it("un seul facteur moyen 1 : faible", () => {
    expect(hfa({ hta: true }).gravite).toBe("faible");
  });
  it("deux facteurs moyens 1 : moyen", () => {
    expect(hfa({ hta: true, diabete: true })).toMatchObject({ score: 2, gravite: "moyen" });
  });
  it("un facteur moyen 2 (radiothérapie) : moyen", () => {
    expect(hfa({ radiotherapie: true }).gravite).toBe("moyen");
  });
  it("4 points : moyen, 5 points : élevé", () => {
    expect(hfa({ hta: true, diabete: true, irc: true, tabac: true }).gravite).toBe("moyen");
    expect(hfa({ hta: true, diabete: true, irc: true, tabac: true, obesite: true }).gravite).toBe("eleve");
  });
  it("FEVG 50-54 % : moyen 2 ; < 50 % : élevé", () => {
    expect(hfa({ fevg: "limite" })).toMatchObject({ score: 2, gravite: "moyen" });
    expect(hfa({ fevg: "basse" }).gravite).toBe("eleve");
  });
  it("âge : 65-79 moyen 2, 80+ élevé", () => {
    expect(hfa({ age: "65-79" }).gravite).toBe("moyen");
    expect(hfa({ age: "80" }).gravite).toBe("eleve");
  });
  it("anthracycline antérieure : élevé à elle seule", () => {
    expect(hfa({ anthracycline: true }).gravite).toBe("eleve");
  });
  it("insuffisance cardiaque : très élevé", () => {
    expect(hfa({ ic: true, hta: true }).gravite).toBe("tres-eleve");
  });
  it("valeurs manquantes ou inconnues : ignorées", () => {
    expect(hfa({ fevg: "inconnue", age: undefined as unknown as string, hta: false }).score).toBe(0);
  });
});

describe("CHA₂DS₂-VA", () => {
  const cas: [Record<string, boolean | string>, string[]][] = [
    [{}, []],
    [{ hta: true, age: "age65" }, ["hta", "age65"]],
    [{ icc: true, diabete: true, avc: true, age: "age75" }, ["icc", "diabete", "avc", "age75"]],
    [{ vasculaire: true, hta: true }, ["vasculaire", "hta"]],
  ];
  it.each(cas)("même résultat que calculs.ts : %j", (valeurs, coches) => {
    expect(cha2ds2vaCalculateur.evaluer(valeurs).score).toBe(cha2ds2va(coches));
  });
  it("seuils d'anticoagulation", () => {
    expect(cha2ds2vaCalculateur.evaluer({}).gravite).toBe("faible");
    expect(cha2ds2vaCalculateur.evaluer({ hta: true }).gravite).toBe("moyen");
    expect(cha2ds2vaCalculateur.evaluer({ hta: true, diabete: true }).gravite).toBe("eleve");
  });
});

import { dfgCkdEpi, qtc } from "./definitions/mesures";
import { cha2ds2vasc } from "./definitions/scores";
import { dfg } from "../calculs";

describe("CHA₂DS₂-VASc", () => {
  const v = (valeurs: Record<string, boolean | string>) => cha2ds2vasc.evaluer(valeurs);
  it("points de la publication", () => {
    // femme (1) + HTA (1) + 75 ans ou plus (2) = 4
    expect(v({ femme: true, hta: true, age: "2" }).score).toBe(4);
    // ICC 1 + HTA 1 + diabète 1 + AVC 2 + vasculaire 1 + femme 1 + 75+ 2 = maximum 9
    expect(v({ icc: true, hta: true, diabete: true, avc: true, vasculaire: true, femme: true, age: "2" }).score).toBe(9);
  });
  it("le sexe féminin seul ne justifie pas l'anticoagulation", () => {
    expect(v({ femme: true }).gravite).toBe("faible");
    expect(v({ femme: true, hta: true }).gravite).toBe("moyen");
    expect(v({ femme: true, hta: true, diabete: true }).gravite).toBe("eleve");
    expect(v({ hta: true }).gravite).toBe("moyen");
    expect(v({ hta: true, diabete: true }).gravite).toBe("eleve");
  });
});

describe("QTc de Fridericia", () => {
  const qtcDe = (qt: number, fc: number, sexe = "H") => qtc.evaluer({ qt, fc, sexe });
  it("QT inchangé à 60 bpm", () => {
    expect(qtcDe(400, 60).libelle).toContain("Fridericia 400 ms");
    expect(qtcDe(400, 60).libelle).toContain("Bazett 400 ms");
  });
  it("QT 400 ms à 75 bpm : Fridericia 431, Bazett 447", () => {
    // RR = 0,8 s : 400 / 0,8^(1/3) = 430,9 ; 400 / 0,8^(1/2) = 447,2
    const l = qtcDe(400, 75).libelle;
    expect(l).toContain("Fridericia 431 ms");
    expect(l).toContain("Bazett 447 ms");
  });
  it("seuils selon le sexe et risque élevé à 500 ms", () => {
    expect(qtcDe(475, 60, "H").gravite).toBe("eleve");
    expect(qtcDe(475, 60, "F").gravite).toBe("faible");
    expect(qtcDe(500, 60, "F").gravite).toBe("tres-eleve");
  });
  it("valeurs manquantes", () => {
    expect(qtc.evaluer({}).gravite).toBe("neutre");
  });
});

describe("DFG CKD-EPI 2021", () => {
  it("valeurs de référence", () => {
    // Homme de 50 ans, créatinine 1,0 mg/dL : 142 × (1/0,9)^-1,2 × 0,9938^50 ≈ 91,7
    expect(dfg(10, 50, "M")).toBeCloseTo(91.7, 0);
    // Femme de 60 ans, créatinine 0,7 mg/dL (= κ) : 142 × 0,9938^60 × 1,012 ≈ 98,9
    expect(dfg(7, 60, "F")).toBeCloseTo(98.9, 0);
    // Homme de 70 ans, créatinine 2,0 mg/dL : 142 × 0,3836 × 0,6471 ≈ 35,2
    expect(dfg(20, 70, "M")).toBeCloseTo(35.2, 0);
  });
  it("le calculateur donne le stade", () => {
    const r = dfgCkdEpi.evaluer({ creatinine: 20, age: 70, sexe: "H" });
    expect(r.libelle).toContain("stade G3b");
    expect(dfgCkdEpi.evaluer({}).gravite).toBe("neutre");
  });
});

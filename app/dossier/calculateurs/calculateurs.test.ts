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

import { describe, expect, it } from "vitest";
import { cha2ds2vaCalculateur } from "./definitions/cha2ds2va";
import { valeursNormalisees } from "./normalisation";

describe("valeursNormalisees", () => {
  it("garde les types prévus et remplit les choix non renseignés par la première option", () => {
    const v = valeursNormalisees(cha2ds2vaCalculateur, { hta: true, age: "age75", inconnu: 3 });
    expect(v.hta).toBe(true);
    expect(v.diabete).toBe(false);
    expect(v.age).toBe("age75");
    expect("inconnu" in v).toBe(false);
  });

  it("refuse une option inconnue et un nombre non fini", () => {
    const v = valeursNormalisees(cha2ds2vaCalculateur, { age: "pas-une-option" });
    expect(v.age).toBe("moins65");
  });

  it("le score enregistré est celui du calcul sur les valeurs normalisées", () => {
    const v = valeursNormalisees(cha2ds2vaCalculateur, { hta: true, age: "age75" });
    expect(cha2ds2vaCalculateur.evaluer(v).score).toBe(cha2ds2vaCalculateur.evaluer({ hta: true, age: "age75" }).score);
  });
});

import { describe, expect, it } from "vitest";
import medicaments from "./medicaments-ma.json";
import { allergieConcernee, famillesDe, familles, repereDe, situations } from "./cardio-medicaments";

describe("repères de cardiologie", () => {
  it("classe par substance, accents et casse ignorés", () => {
    expect(famillesDe("Ramipril")).toEqual(["iec"]);
    expect(famillesDe("PÉRINDOPRIL, Indapamide")).toEqual(["iec", "thiazidique"]);
    expect(famillesDe("Paracétamol")).toEqual([]);
  });
  it("les situations ne citent que des familles existantes", () => {
    const cles = new Set(familles.map((f) => f.cle));
    for (const s of situations) for (const f of s.familles) expect(cles.has(f), `${s.cle} → ${f}`).toBe(true);
  });
  it("a un repère de posologie pour les substances courantes", () => {
    expect(repereDe("Rivaroxaban")?.posologie).toMatch(/20 mg/);
    expect(repereDe("Paracétamol")).toBeUndefined();
  });
  it("chaque famille trouve des produits dans la base importée (sauf rares)", () => {
    const vides = familles.filter((f) => !(medicaments as { dci: string }[]).some((m) => famillesDe(m.dci).includes(f.cle)));
    expect(vides.map((f) => f.cle)).toEqual([]);
  });
  it("repère les allergies", () => {
    expect(allergieConcernee("Pénicilline, piment", "AMOXICILLINE", "")).toBeNull();
    expect(allergieConcernee("aspirine", "KARDEGIC", "acide acetylsalicylique")).toBeNull();
    expect(allergieConcernee("Aspirine", "ASPIRINE 100", "")).toBe("aspirine");
  });
});

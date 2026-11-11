import { describe, expect, it } from "vitest";
import { donneesPourCalculs } from "./donnees-calculs";
import type { Consultation } from "./consultations";
import type { Patient } from "./patients";

const patient = {
  sexe: "F",
  poids: 60,
  taille: 165,
  tabac: "ancien",
  alcoolVerres: 2,
  facteursRisque: ["HTA"],
} as unknown as Patient;

const consultation = (c: Partial<Consultation>): Consultation =>
  ({ id: 1, date: "2026-10-01", taSys: null, taDia: null, fc: null, spo2: null, poids: null, taille: null, mesures: {}, ...c }) as Consultation;

describe("donneesPourCalculs", () => {
  it("la fiche prime pour le poids et la taille, puis la dernière consultation", () => {
    const d = donneesPourCalculs({ patient, age: 70, consultations: [consultation({ poids: 80 })], fevgEchos: [] });
    expect(d.poids).toBe(60);
    expect(d.poidsOrigine).toBe("fiche patient");
    const sans = donneesPourCalculs({
      patient: { ...patient, poids: null, taille: null },
      age: 70,
      consultations: [consultation({ poids: 80, taille: 170 })],
      fevgEchos: [],
    });
    expect([sans.poids, sans.taille, sans.poidsOrigine]).toEqual([80, 170, "dernière consultation"]);
  });

  it("la mesure la plus récente passe avant la valeur de base (FEVG, créatinine)", () => {
    const d = donneesPourCalculs({
      patient,
      age: 70,
      consultations: [consultation({ date: "2026-09-01", mesures: { fevg: 45, creatinine: 12 } })],
      fevgEchos: [{ date: "2026-10-15", valeur: 52 }],
    });
    expect(d.fevg).toBe(52);
    expect(d.fevgOrigine).toBe("échographie du dossier");
    expect(d.creatinine).toBe(12);
    const base = donneesPourCalculs({ patient, age: 70, consultations: [], fevgEchos: [] });
    expect([base.fevg, base.creatinine]).toEqual([null, null]);
  });

  it("pendant une consultation, ses propres mesures passent en premier", () => {
    const ici = consultation({ id: 7, poids: 71, fc: 88, mesures: { fevg: 40, creatinine: 15 } });
    const d = donneesPourCalculs({ patient, age: 70, consultations: [ici], fevgEchos: [{ date: "2026-12-01", valeur: 60 }], consultation: ici });
    expect([d.poids, d.fc, d.fevg, d.creatinine]).toEqual([71, 88, 40, 15]);
    expect([d.poidsOrigine, d.fevgOrigine, d.creatinineOrigine]).toEqual(["cette consultation", "cette consultation", "cette consultation"]);
    expect(d.taille).toBe(165);
    expect(d.tailleOrigine).toBe("fiche patient");
  });

  it("reprend le mode de vie et les facteurs de risque de la fiche", () => {
    const d = donneesPourCalculs({ patient, age: 70, consultations: [], fevgEchos: [] });
    expect([d.tabac, d.alcoolVerres, d.sexe, d.facteurs]).toEqual(["ancien", 2, "F", ["HTA"]]);
  });
});

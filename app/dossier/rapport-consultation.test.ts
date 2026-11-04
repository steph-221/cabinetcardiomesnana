import { describe, expect, it } from "vitest";
import { elementsRapport } from "./rapport-consultation";
import type { Examen } from "./examens";
import type { Ordonnance } from "./ordonnances";
import type { ScorePatient } from "./scores-patients";

const consultation = { id: 5, date: "2026-11-04" };
const score = (c: Partial<ScorePatient>): ScorePatient =>
  ({ id: 1, slug: "x", titre: "CHA₂DS₂-VA", date: "2026-11-04", valeurs: {}, score: 3, libelle: "Anticoagulation recommandée", gravite: "eleve", consultationId: 5, creePar: "dr", ...c }) as ScorePatient;
const examen = (c: Partial<Examen>): Examen =>
  ({ id: 1, type: "ECG", date: "2026-11-04", conclusion: "ACFA à 72/min", valeurs: {}, consultationId: 5, ...c }) as Examen;
const ordonnance = (c: Partial<Ordonnance>): Ordonnance =>
  ({ id: 1, patientId: 1, date: "2026-11-04", lignes: [{ medicament: "Bisoprolol 5 mg", posologie: "1 cp le matin", duree: "3 mois" }], remarque: "", fichierDrive: null, consultationId: 5, creePar: "dr", ...c }) as Ordonnance;

describe("elementsRapport", () => {
  it("reprend seulement ce qui est rattaché à cette consultation", () => {
    const r = elementsRapport(consultation, {
      scores: [score({}), score({ id: 2, consultationId: 9 }), score({ id: 3, consultationId: null })],
      examens: [examen({}), examen({ id: 2, consultationId: 9, type: "Holter ECG" })],
      ordonnances: [ordonnance({}), ordonnance({ id: 2, consultationId: null })],
    });
    expect(r.calculs).toEqual(["CHA₂DS₂-VA : score 3, Anticoagulation recommandée"]);
    expect(r.examens).toEqual(["ECG : ACFA à 72/min"]);
    expect(r.ordonnances).toEqual(["- Bisoprolol 5 mg — 1 cp le matin (3 mois)"]);
  });

  it("rien de rattaché : rien à ajouter au rapport", () => {
    expect(elementsRapport(consultation, { scores: [], examens: [], ordonnances: [] })).toEqual({ calculs: [], examens: [], ordonnances: [] });
  });

  it("rappelle la date seulement si elle diffère de celle de la consultation", () => {
    const r = elementsRapport(consultation, {
      scores: [score({ date: "2026-11-02" })],
      examens: [examen({ date: "2026-11-03", conclusion: "" })],
      ordonnances: [ordonnance({ date: "2026-11-05", remarque: "Contrôle INR dans 15 jours" })],
    });
    expect(r.calculs[0]).toContain("du 02/11/2026");
    expect(r.examens).toEqual(["ECG du 03/11/2026"]);
    expect(r.ordonnances).toEqual([
      "Ordonnance du 05/11/2026 :",
      "- Bisoprolol 5 mg — 1 cp le matin (3 mois)",
      "Remarque : Contrôle INR dans 15 jours",
    ]);
  });

  it("calcul sans score (formule) : seulement le résultat", () => {
    expect(elementsRapport(consultation, { scores: [score({ score: null, titre: "DFG", libelle: "55 mL/min" })], examens: [], ordonnances: [] }).calculs).toEqual(["DFG : 55 mL/min"]);
  });

  it("plusieurs ordonnances : chacune est introduite par sa date", () => {
    const r = elementsRapport(consultation, { scores: [], examens: [], ordonnances: [ordonnance({}), ordonnance({ id: 2 })] });
    expect(r.ordonnances.filter((l) => l.startsWith("Ordonnance")).length).toBe(2);
  });

  it("un compte rendu long est résumé sur une ligne", () => {
    const long = `Ligne un\n\nLigne deux ${"x".repeat(700)}`;
    const [ligne] = elementsRapport(consultation, { scores: [], examens: [examen({ conclusion: long })], ordonnances: [] }).examens;
    expect(ligne.includes("\n")).toBe(false);
    expect(ligne.endsWith("…")).toBe(true);
    expect(ligne.length).toBeLessThan(640);
  });
});

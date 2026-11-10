// Préparation d'une consultation : ce qui a changé depuis la dernière visite et ce qui attend le médecin, d'après le
// dossier. Réservé aux comptes médicaux. Les alertes sont celles du dossier (calculs.ts) : des aides.

import { jourLocal } from "../agenda/creneaux";
import { alertes, type Alerte } from "./calculs";
import { base } from "./base";
import { listerConsultations } from "./consultations";
import { fevgDesExamens } from "./donnees-calculs";
import { listerExamens } from "./examens";
import { age, lirePatient, listerTraitements } from "./patients";
import { listerSuivisPatient } from "./suivis";

export type Preparation = {
  patientId: number;
  allergies: string;
  derniere: { date: string; motif: string; conclusion: string; conduite: string } | null;
  consultations: number;
  alertes: Alerte[];
  traitements: string[];
  suivisDus: { quoi: string; echeance: string; enRetard: boolean }[];
  // Résultats d'analyses reçus et pas encore relus pour ce patient
  resultatsARelire: number;
  examensDepuisDerniere: number;
};

export async function preparer(patientId: number): Promise<Preparation | null> {
  const patient = await lirePatient(patientId);
  if (!patient) return null;
  const sql = await base();
  const [consultations, traitements, examens, suivis, resultats] = await Promise.all([
    listerConsultations(patientId),
    listerTraitements(patientId),
    listerExamens(patientId),
    listerSuivisPatient(patientId),
    sql`SELECT count(*)::int AS n FROM resultats_recus WHERE patient_id = ${patientId} AND statut = 'a_relire'`,
  ]);
  const aujourdhui = jourLocal(new Date());
  const enCours = traitements.filter((t) => !t.fin).map((t) => t.medicament);
  const fevgEchos = fevgDesExamens(examens);
  const signaux = alertes({
    releves: [
      ...consultations,
      ...fevgEchos.map((f) => ({ date: f.date, taSys: null, taDia: null, fc: null, mesures: { fevg: f.valeur } })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
    traitementsEnCours: enCours,
    inrMin: patient.inrMin,
    inrMax: patient.inrMax,
    age: age(patient.naissance, aujourdhui),
    sexe: patient.sexe,
  });
  const derniere = consultations[0] ?? null;
  return {
    patientId,
    allergies: patient.allergies,
    derniere: derniere ? { date: derniere.date, motif: derniere.motif, conclusion: derniere.conclusion, conduite: derniere.conduite } : null,
    consultations: consultations.length,
    alertes: signaux,
    traitements: enCours,
    suivisDus: suivis.filter((s) => s.statut !== "fait" && s.echeance <= aujourdhui).map((s) => ({ quoi: s.quoi, echeance: s.echeance, enRetard: s.echeance < aujourdhui })),
    resultatsARelire: resultats[0].n as number,
    examensDepuisDerniere: derniere ? examens.filter((e) => e.date > derniere.date).length : 0,
  };
}

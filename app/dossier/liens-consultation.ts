// Liens entre une consultation et ce qui s'y rapporte : calculs, examens (dont les résultats reçus), ordonnances, facture.
// Un élément créé se rattache tout seul à la consultation du même jour quand elle est unique ; sinon, ou pour corriger,
// le médecin le rattache ou le détache à la main depuis la consultation.

import { base } from "./base";

export type TypeLien = "examen" | "ordonnance" | "facture" | "score";

export const typesLien: readonly TypeLien[] = ["examen", "ordonnance", "facture", "score"];

// Noms de tables fixes : jamais construits à partir d'une saisie
const tables: Record<TypeLien, string> = {
  examen: "examens",
  ordonnance: "ordonnances",
  facture: "factures",
  score: "scores_patients",
};

// Consultation d'un jour donné, seulement s'il n'y en a qu'une (sinon on ne devine pas)
export async function consultationDuJour(patientId: number, date: string): Promise<number | null> {
  const sql = await base();
  const lignes = await sql`SELECT id FROM consultations WHERE patient_id = ${patientId} AND date = ${date} LIMIT 2`;
  return lignes.length === 1 ? (lignes[0].id as number) : null;
}

// Rattache (ou détache, avec null) un élément du patient à l'une de ses consultations.
// Faux si l'élément ou la consultation n'appartient pas à ce patient.
export async function rattacher(type: TypeLien, patientId: number, id: number, consultationId: number | null) {
  const sql = await base();
  const lignes = await sql.query(
    `UPDATE ${tables[type]} SET consultation_id = $1
     WHERE id = $2 AND patient_id = $3
       AND ($1::int IS NULL OR EXISTS (SELECT 1 FROM consultations WHERE id = $1 AND patient_id = $3))
     RETURNING id`,
    [consultationId, id, patientId],
  );
  return lignes.length > 0;
}

// À la création d'une consultation : ce qui existe déjà pour le même jour et n'est rattaché à rien s'y rattache,
// sauf s'il y a deux consultations ce jour-là (on ne devine pas laquelle).
export async function rattacherElementsDuJour(patientId: number, date: string, consultationId: number) {
  const sql = await base();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM consultations WHERE patient_id = ${patientId} AND date = ${date}`;
  if (n !== 1) return;
  for (const table of Object.values(tables)) {
    await sql.query(
      `UPDATE ${table} SET consultation_id = $1 WHERE patient_id = $2 AND date = $3 AND consultation_id IS NULL`,
      [consultationId, patientId, date],
    );
  }
}

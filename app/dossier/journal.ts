// Journal des accès aux dossiers : qui a consulté ou modifié quoi, et quand. Consultable par l'administrateur.

import { base } from "./base";

export type Entree = { quand: Date; qui: string; action: string; patientId: number | null; detail: string };

export async function journaliser(qui: string, action: string, patientId: number | null, detail = "") {
  const sql = await base();
  await sql`INSERT INTO journal (qui, action, patient_id, detail) VALUES (${qui}, ${action}, ${patientId}, ${detail})`;
}

export async function lireJournal(patientId: number | null, limite = 200): Promise<Entree[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT quand, qui, action, patient_id, detail FROM journal
    WHERE ${patientId === null} OR patient_id = ${patientId}
    ORDER BY quand DESC LIMIT ${limite}`;
  return lignes.map((l) => ({
    quand: l.quand as Date,
    qui: l.qui as string,
    action: l.action as string,
    patientId: l.patient_id as number | null,
    detail: l.detail as string,
  }));
}

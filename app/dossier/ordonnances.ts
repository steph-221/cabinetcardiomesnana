// Ordonnances : lignes de prescription (médicament, posologie, durée), remarque, et copie PDF rangée dans Drive

import { base } from "./base";

export type LigneOrdonnance = { medicament: string; posologie: string; duree: string };

export type Ordonnance = {
  id: number;
  patientId: number;
  date: string; // "AAAA-MM-JJ"
  lignes: LigneOrdonnance[];
  remarque: string;
  fichierDrive: string | null;
  creePar: string;
};

const versOrdonnance = (l: Record<string, unknown>): Ordonnance => ({
  id: l.id as number,
  patientId: l.patient_id as number,
  date: l.date as string,
  lignes: l.lignes as LigneOrdonnance[],
  remarque: l.remarque as string,
  fichierDrive: (l.fichier_drive as string | null) ?? null,
  creePar: l.cree_par as string,
});

export async function listerOrdonnances(patientId: number) {
  const sql = await base();
  const lignes = await sql`SELECT * FROM ordonnances WHERE patient_id = ${patientId} ORDER BY date DESC, id DESC`;
  return lignes.map(versOrdonnance);
}

export async function lireOrdonnance(id: number) {
  const sql = await base();
  const [ligne] = await sql`SELECT * FROM ordonnances WHERE id = ${id}`;
  return ligne ? versOrdonnance(ligne) : null;
}

export async function creerOrdonnance(
  patientId: number,
  o: { date: string; lignes: LigneOrdonnance[]; remarque: string },
  par: string,
) {
  const sql = await base();
  const [[{ id }]] = await sql.transaction([
    sql`INSERT INTO ordonnances (patient_id, date, lignes, remarque, cree_par)
        VALUES (${patientId}, ${o.date}, ${JSON.stringify(o.lignes)}::jsonb, ${o.remarque}, ${par}) RETURNING id`,
    sql`UPDATE patients SET modifie_le = now(), modifie_par = ${par} WHERE id = ${patientId}`,
  ]);
  return id as number;
}

export async function rangerOrdonnance(id: number, fichierDrive: string) {
  const sql = await base();
  await sql`UPDATE ordonnances SET fichier_drive = ${fichierDrive} WHERE id = ${id}`;
}

export async function supprimerOrdonnance(patientId: number, id: number) {
  const sql = await base();
  const [ligne] =
    await sql`DELETE FROM ordonnances WHERE id = ${id} AND patient_id = ${patientId} RETURNING fichier_drive`;
  return (ligne?.fichier_drive as string | null | undefined) ?? null;
}

// Ordonnances : lignes de prescription (médicament, posologie, durée), remarque, et copie PDF rangée dans Drive

import { base } from "./base";
import { consultationDuJour } from "./liens-consultation";

// `fiche` : lien vers la fiche medicament.ma quand le médicament vient de la base de référence (sert aux alertes)
export type LigneOrdonnance = { medicament: string; posologie: string; duree: string; fiche?: string };

// Une prescription d'analyses biologiques est une ordonnance de type « biologie » : une analyse par ligne
export type TypeOrdonnance = "medicaments" | "biologie";

export type Ordonnance = {
  id: number;
  type: TypeOrdonnance;
  patientId: number;
  date: string; // "AAAA-MM-JJ"
  lignes: LigneOrdonnance[];
  remarque: string;
  // Demande d'examens en texte libre (radio, coronarographie, épreuve d'effort…), imprimée sur la même feuille
  examens: string;
  fichierDrive: string | null;
  consultationId: number | null;
  creePar: string;
};

const versOrdonnance = (l: Record<string, unknown>): Ordonnance => ({
  id: l.id as number,
  type: l.type === "biologie" ? "biologie" : "medicaments",
  patientId: l.patient_id as number,
  date: l.date as string,
  lignes: l.lignes as LigneOrdonnance[],
  remarque: l.remarque as string,
  examens: (l.examens as string | null | undefined) ?? "",
  fichierDrive: (l.fichier_drive as string | null) ?? null,
  consultationId: (l.consultation_id as number | null | undefined) ?? null,
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
  // Consultation concernée ; à défaut, celle du même jour si elle est unique
  o: { date: string; lignes: LigneOrdonnance[]; remarque: string; examens?: string; consultationId?: number | null; type?: TypeOrdonnance },
  par: string,
) {
  const sql = await base();
  const consultation = o.consultationId !== undefined ? o.consultationId : await consultationDuJour(patientId, o.date);
  const [[{ id }]] = await sql.transaction([
    sql`INSERT INTO ordonnances (patient_id, date, lignes, remarque, examens, type, consultation_id, cree_par)
        VALUES (${patientId}, ${o.date}, ${JSON.stringify(o.lignes)}::jsonb, ${o.remarque}, ${o.examens ?? ""}, ${o.type ?? "medicaments"},
                (SELECT id FROM consultations WHERE id = ${consultation}::int AND patient_id = ${patientId}), ${par})
        RETURNING id`,
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

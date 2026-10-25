// Examens du patient : ECG, échographies, Holter, biologie… Le fichier est rangé dans Google Drive,
// la base garde le type, la date, la conclusion et (plus tard) les valeurs mesurées.

import { base } from "./base";

export const typesExamen = [
  "ECG",
  "Échocardiographie (ETT)",
  "Holter ECG",
  "MAPA",
  "Épreuve d'effort",
  "Biologie",
  "Doppler vasculaire",
  "Coroscanner",
  "Coronarographie",
  "Compte rendu",
  "Ordonnance",
  "Autre",
];

// Fichiers acceptés (les photos sont converties en JPEG par le navigateur avant l'envoi)
export const typesFichier = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
// Vercel refuse les requêtes de plus de 4,5 Mo
export const TAILLE_MAX = 4 * 1024 * 1024;

export type Examen = {
  id: number;
  type: string;
  date: string; // "AAAA-MM-JJ"
  conclusion: string;
  fichierDrive: string | null;
  fichierNom: string;
  fichierType: string;
  fichierTaille: number;
  creeLe: Date;
  creePar: string;
};

const versExamen = (l: Record<string, unknown>): Examen => ({
  id: l.id as number,
  type: l.type as string,
  date: l.date as string,
  conclusion: l.conclusion as string,
  fichierDrive: l.fichier_drive as string | null,
  fichierNom: l.fichier_nom as string,
  fichierType: l.fichier_type as string,
  fichierTaille: l.fichier_taille as number,
  creeLe: l.cree_le as Date,
  creePar: l.cree_par as string,
});

export async function listerExamens(patientId: number) {
  const sql = await base();
  const lignes = await sql`SELECT * FROM examens WHERE patient_id = ${patientId} ORDER BY date DESC, id DESC`;
  return lignes.map(versExamen);
}

export async function lireExamen(id: number) {
  const sql = await base();
  const [ligne] = await sql`SELECT * FROM examens WHERE id = ${id}`;
  return ligne ? { ...versExamen(ligne), patientId: ligne.patient_id as number } : null;
}

export async function ajouterExamen(
  patientId: number,
  e: {
    type: string;
    date: string;
    conclusion: string;
    fichier: { drive: string; nom: string; type: string; taille: number } | null;
  },
  par: string,
) {
  const sql = await base();
  const [[{ id }]] = await sql.transaction([
    sql`INSERT INTO examens (patient_id, type, date, conclusion, fichier_drive, fichier_nom, fichier_type,
                             fichier_taille, cree_par)
        VALUES (${patientId}, ${e.type}, ${e.date}, ${e.conclusion}, ${e.fichier?.drive ?? null},
                ${e.fichier?.nom ?? ""}, ${e.fichier?.type ?? ""}, ${e.fichier?.taille ?? 0}, ${par})
        RETURNING id`,
    sql`UPDATE patients SET modifie_le = now(), modifie_par = ${par} WHERE id = ${patientId}`,
  ]);
  return id as number;
}

export async function modifierConclusion(patientId: number, id: number, conclusion: string) {
  const sql = await base();
  await sql`UPDATE examens SET conclusion = ${conclusion} WHERE id = ${id} AND patient_id = ${patientId}`;
}

export async function supprimerExamen(patientId: number, id: number) {
  const sql = await base();
  const [ligne] = await sql`DELETE FROM examens WHERE id = ${id} AND patient_id = ${patientId} RETURNING fichier_drive`;
  return (ligne?.fichier_drive as string | null | undefined) ?? null;
}

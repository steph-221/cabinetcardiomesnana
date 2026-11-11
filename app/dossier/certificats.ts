// Certificats médicaux : texte final enregistré (il peut avoir été retouché), copie PDF rangée dans Drive

import { base } from "./base";
import { consultationDuJour } from "./liens-consultation";

export type Certificat = {
  id: number;
  patientId: number;
  date: string; // "AAAA-MM-JJ"
  modele: string;
  champs: Record<string, string>;
  texte: string;
  fichierDrive: string | null;
  consultationId: number | null;
  creePar: string;
};

const versCertificat = (l: Record<string, unknown>): Certificat => ({
  id: l.id as number,
  patientId: l.patient_id as number,
  date: l.date as string,
  modele: l.modele as string,
  champs: (l.champs as Record<string, string>) ?? {},
  texte: l.texte as string,
  fichierDrive: (l.fichier_drive as string | null) ?? null,
  consultationId: (l.consultation_id as number | null | undefined) ?? null,
  creePar: l.cree_par as string,
});

export async function listerCertificats(patientId: number) {
  const sql = await base();
  const lignes = await sql`SELECT * FROM certificats WHERE patient_id = ${patientId} ORDER BY date DESC, id DESC`;
  return lignes.map(versCertificat);
}

export async function lireCertificat(id: number) {
  const sql = await base();
  const [ligne] = await sql`SELECT * FROM certificats WHERE id = ${id}`;
  return ligne ? versCertificat(ligne) : null;
}

export async function creerCertificat(
  patientId: number,
  c: { date: string; modele: string; champs: Record<string, string>; texte: string; consultationId?: number | null },
  par: string,
) {
  const sql = await base();
  const consultation = c.consultationId !== undefined ? c.consultationId : await consultationDuJour(patientId, c.date);
  const [[{ id }]] = await sql.transaction([
    sql`INSERT INTO certificats (patient_id, date, modele, champs, texte, consultation_id, cree_par)
        VALUES (${patientId}, ${c.date}, ${c.modele}, ${JSON.stringify(c.champs)}::jsonb, ${c.texte},
                (SELECT id FROM consultations WHERE id = ${consultation}::int AND patient_id = ${patientId}), ${par})
        RETURNING id`,
    sql`UPDATE patients SET modifie_le = now(), modifie_par = ${par} WHERE id = ${patientId}`,
  ]);
  return id as number;
}

export async function rangerCertificat(id: number, fichierDrive: string) {
  const sql = await base();
  await sql`UPDATE certificats SET fichier_drive = ${fichierDrive} WHERE id = ${id}`;
}

export async function supprimerCertificat(patientId: number, id: number) {
  const sql = await base();
  const [ligne] =
    await sql`DELETE FROM certificats WHERE id = ${id} AND patient_id = ${patientId} RETURNING fichier_drive`;
  return (ligne?.fichier_drive as string | null | undefined) ?? null;
}

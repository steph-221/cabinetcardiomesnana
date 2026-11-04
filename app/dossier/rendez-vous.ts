// Rendez-vous de l'agenda reliés aux dossiers patients.
// Un rendez-vous est « lié » quand l'événement porte le numéro du dossier. Sinon on propose à la secrétaire
// le dossier probable (même téléphone, ou même nom, prénom et date de naissance) : elle décide de rattacher.

import { base } from "./base";
import { finTelephone, rechercherPatients } from "./patients";

export type DossierPropose = {
  id: number;
  nom: string;
  prenom: string;
  naissance: string | null;
  email: string;
  telephone: string;
};

export type Correspondance = {
  patient: DossierPropose;
  lien: "lie" | "telephone" | "identite";
};

type RdvAssocie = {
  id: string;
  patientId?: number;
  nom: string;
  prenom: string;
  telephone?: string;
  dateNaissance?: string;
};

const COLONNES = "id, nom, prenom, naissance, email, telephone";
const versDossier = (l: Record<string, unknown>): DossierPropose => ({
  id: l.id as number,
  nom: l.nom as string,
  prenom: l.prenom as string,
  naissance: l.naissance as string | null,
  email: l.email as string,
  telephone: l.telephone as string,
});

export async function correspondances(rdvs: RdvAssocie[]): Promise<Map<string, Correspondance>> {
  const resultat = new Map<string, Correspondance>();
  if (!rdvs.length) return resultat;
  const sql = await base();

  // 1. Rendez-vous déjà rattachés à un dossier
  const ids = [...new Set(rdvs.flatMap((r) => (r.patientId ? [r.patientId] : [])))];
  if (ids.length) {
    const lignes = await sql.query(`SELECT ${COLONNES} FROM patients WHERE id = ANY($1)`, [ids]);
    const parId = new Map(lignes.map((l) => [l.id as number, versDossier(l)]));
    for (const r of rdvs) {
      const patient = r.patientId ? parId.get(r.patientId) : undefined;
      if (patient) resultat.set(r.id, { patient, lien: "lie" });
    }
  }

  // 2. Même téléphone (9 derniers chiffres)
  const restants = rdvs.filter((r) => !resultat.has(r.id));
  const fins = [...new Set(restants.flatMap((r) => (r.telephone && finTelephone(r.telephone).length === 9 ? [finTelephone(r.telephone)] : [])))];
  if (fins.length) {
    const lignes = await sql.query(
      `SELECT DISTINCT ON (right(telephone_chiffres, 9)) right(telephone_chiffres, 9) AS fin, ${COLONNES}
       FROM patients WHERE right(telephone_chiffres, 9) = ANY($1)
       ORDER BY right(telephone_chiffres, 9), modifie_le DESC`,
      [fins],
    );
    const parFin = new Map(lignes.map((l) => [l.fin as string, versDossier(l)]));
    for (const r of restants) {
      const patient = r.telephone ? parFin.get(finTelephone(r.telephone)) : undefined;
      if (patient) resultat.set(r.id, { patient, lien: "telephone" });
    }
  }

  // 3. Même nom, prénom et date de naissance
  const aIdentifier = rdvs.filter((r) => !resultat.has(r.id) && r.nom && r.prenom && /^\d{4}-\d{2}-\d{2}$/.test(r.dateNaissance ?? ""));
  if (aIdentifier.length) {
    const lignes = await sql.query(
      `SELECT t.idx, p.id, p.nom, p.prenom, p.naissance, p.email, p.telephone
       FROM unnest($1::text[], $2::text[], $3::date[]) WITH ORDINALITY AS t(nom, prenom, naissance, idx)
       JOIN patients p ON unaccent(lower(p.nom)) = unaccent(lower(t.nom))
        AND unaccent(lower(p.prenom)) = unaccent(lower(t.prenom)) AND p.naissance = t.naissance
       ORDER BY p.modifie_le DESC`,
      [aIdentifier.map((r) => r.nom), aIdentifier.map((r) => r.prenom), aIdentifier.map((r) => r.dateNaissance)],
    );
    for (const l of lignes) {
      const r = aIdentifier[Number(l.idx) - 1];
      if (r && !resultat.has(r.id)) resultat.set(r.id, { patient: versDossier(l), lien: "identite" });
    }
  }
  return resultat;
}

// Recherche pour relier un rendez-vous pris à la main à un dossier existant
export async function chercherPourRendezvous(recherche: string): Promise<DossierPropose[]> {
  const trouves = await rechercherPatients(recherche, 6);
  if (!trouves.length) return [];
  const sql = await base();
  const lignes = await sql.query(`SELECT ${COLONNES} FROM patients WHERE id = ANY($1)`, [trouves.map((p) => p.id)]);
  const parId = new Map(lignes.map((l) => [l.id as number, versDossier(l)]));
  return trouves.flatMap((p) => parId.get(p.id) ?? []);
}

// Complète seulement ce qui manque dans le dossier : n'écrase jamais une information déjà saisie
export async function completerIdentite(
  id: number,
  apport: { naissance?: string; email?: string; telephone?: string },
  par: string,
) {
  const sql = await base();
  await sql`
    UPDATE patients SET
      naissance = COALESCE(naissance, ${apport.naissance || null}::date),
      email = CASE WHEN email = '' THEN ${apport.email ?? ""} ELSE email END,
      telephone = CASE WHEN telephone = '' THEN ${apport.telephone ?? ""} ELSE telephone END,
      modifie_le = now(), modifie_par = ${par}
    WHERE id = ${id}
      AND ((naissance IS NULL AND ${Boolean(apport.naissance)})
        OR (email = '' AND ${Boolean(apport.email)})
        OR (telephone = '' AND ${Boolean(apport.telephone)}))`;
}

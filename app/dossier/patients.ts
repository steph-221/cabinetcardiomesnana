// Dossiers patients : identité, contenu médical de base, traitements.
// Les droits (secrétaire / médecin) sont vérifiés par les actions et les pages qui appellent ces fonctions.

import { base } from "./base";

export const facteursRisque = [
  "HTA",
  "Diabète",
  "Dyslipidémie",
  "Tabac",
  "Hérédité coronaire",
  "Obésité",
  "Insuffisance rénale",
  "Sédentarité",
] as const;

export const couvertures = ["CNSS", "CNOPS", "AMO Tadamon", "FAR", "Mutuelle / assurance privée", "Aucune"];

export type Identite = {
  nom: string;
  prenom: string;
  sexe: "" | "F" | "M";
  naissance: string | null; // "AAAA-MM-JJ"
  telephone: string;
  email: string;
  cin: string;
  adresse: string;
  couverture: string;
  medecinTraitant: string;
};

export type ContenuMedical = {
  facteursRisque: string[];
  antecedents: string;
  allergies: string;
  notes: string;
};

export type Patient = Identite &
  ContenuMedical & { id: number; creeLe: Date; creePar: string; modifieLe: Date; modifiePar: string };

export type ResumePatient = Pick<Patient, "id" | "nom" | "prenom" | "sexe" | "naissance" | "telephone" | "modifieLe">;

export type Traitement = {
  id: number;
  medicament: string;
  posologie: string;
  debut: string | null;
  fin: string | null;
};

type Ligne = Record<string, unknown>;

const versPatient = (l: Ligne): Patient => ({
  id: l.id as number,
  nom: l.nom as string,
  prenom: l.prenom as string,
  sexe: l.sexe as Patient["sexe"],
  naissance: l.naissance as string | null,
  telephone: l.telephone as string,
  email: l.email as string,
  cin: l.cin as string,
  adresse: l.adresse as string,
  couverture: l.couverture as string,
  medecinTraitant: l.medecin_traitant as string,
  facteursRisque: l.facteurs_risque as string[],
  antecedents: l.antecedents as string,
  allergies: l.allergies as string,
  notes: l.notes as string,
  creeLe: l.cree_le as Date,
  creePar: l.cree_par as string,
  modifieLe: l.modifie_le as Date,
  modifiePar: l.modifie_par as string,
});

// Les 9 derniers chiffres suffisent à reconnaître un numéro marocain, qu'il soit saisi 06…, +212 6… ou 00212 6…
export const finTelephone = (telephone: string) => telephone.replace(/\D/g, "").slice(-9);

// Lien WhatsApp vers le patient (numéro marocain 06… / 07… converti au format international)
export function lienWhatsApp(telephone: string) {
  let chiffres = telephone.replace(/\D/g, "");
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  else if (chiffres.length === 10 && chiffres.startsWith("0")) chiffres = `212${chiffres.slice(1)}`;
  return chiffres.length >= 11 ? `https://wa.me/${chiffres}` : null;
}

export const libellePatient = (p: Pick<Patient, "nom" | "prenom">) =>
  [p.nom.toUpperCase(), p.prenom].filter(Boolean).join(" ");

export function age(naissance: string | null, aujourdhui: string) {
  if (!naissance) return null;
  const [a, m, j] = naissance.split("-").map(Number);
  const [aa, mm, jj] = aujourdhui.split("-").map(Number);
  return aa - a - (mm < m || (mm === m && jj < j) ? 1 : 0);
}

// Recherche par nom et prénom (dans n'importe quel ordre, sans tenir compte des accents), téléphone ou n° de dossier.
// Sans recherche : les dossiers modifiés le plus récemment.
export async function rechercherPatients(recherche: string, limite = 50): Promise<ResumePatient[]> {
  const sql = await base();
  const colonnes = "id, nom, prenom, sexe, naissance, telephone, modifie_le";
  const q = recherche.trim();
  if (!q) {
    const lignes = await sql.query(`SELECT ${colonnes} FROM patients ORDER BY modifie_le DESC LIMIT $1`, [limite]);
    return lignes.map((l) => versPatient(l));
  }

  const conditions: string[] = [];
  const valeurs: unknown[] = [];
  const mots = q.split(/\s+/).filter((m) => /\p{L}/u.test(m));
  if (mots.length) {
    conditions.push(
      mots
        .map((mot) => {
          valeurs.push(`%${mot.replace(/[\\%_]/g, "\\$&")}%`);
          return `unaccent(lower(nom || ' ' || prenom)) LIKE unaccent(lower($${valeurs.length}))`;
        })
        .join(" AND "),
    );
  }
  const chiffres = q.replace(/\D/g, "");
  if (chiffres.length >= 6) {
    valeurs.push(`%${chiffres.slice(-9)}%`);
    conditions.push(`telephone_chiffres LIKE $${valeurs.length}`);
  } else if (chiffres.length > 0 && /^(n°|no|#)?\s*\d+$/i.test(q)) {
    valeurs.push(Number(chiffres));
    conditions.push(`id = $${valeurs.length}`);
  }
  if (!conditions.length) return [];

  valeurs.push(limite);
  const lignes = await sql.query(
    `SELECT ${colonnes} FROM patients WHERE ${conditions.map((c) => `(${c})`).join(" OR ")}
     ORDER BY nom, prenom LIMIT $${valeurs.length}`,
    valeurs,
  );
  return lignes.map((l) => versPatient(l));
}

export async function lirePatient(id: number) {
  const sql = await base();
  const [ligne] = await sql`SELECT * FROM patients WHERE id = ${id}`;
  return ligne ? versPatient(ligne) : null;
}

// Dossiers qui ressemblent à celui qu'on va créer : même téléphone, ou même nom, prénom et date de naissance
export async function doublonsPossibles(identite: Identite, saufId?: number): Promise<ResumePatient[]> {
  const sql = await base();
  const telephone = finTelephone(identite.telephone);
  const lignes = await sql`
    SELECT id, nom, prenom, sexe, naissance, telephone, modifie_le FROM patients
    WHERE id <> ${saufId ?? 0} AND (
      (${telephone.length === 9} AND right(telephone_chiffres, 9) = ${telephone})
      OR (unaccent(lower(nom)) = unaccent(lower(${identite.nom}))
          AND unaccent(lower(prenom)) = unaccent(lower(${identite.prenom}))
          AND naissance IS NOT DISTINCT FROM ${identite.naissance}::date)
    )
    LIMIT 5`;
  return lignes.map((l) => versPatient(l));
}

export async function creerPatient(identite: Identite, medical: ContenuMedical | null, par: string) {
  const sql = await base();
  const m = medical ?? { facteursRisque: [], antecedents: "", allergies: "", notes: "" };
  const [{ id }] = await sql`
    INSERT INTO patients (nom, prenom, sexe, naissance, telephone, email, cin, adresse, couverture, medecin_traitant,
                          facteurs_risque, antecedents, allergies, notes, cree_par, modifie_par)
    VALUES (${identite.nom}, ${identite.prenom}, ${identite.sexe}, ${identite.naissance}, ${identite.telephone},
            ${identite.email}, ${identite.cin}, ${identite.adresse}, ${identite.couverture}, ${identite.medecinTraitant},
            ${m.facteursRisque}, ${m.antecedents}, ${m.allergies}, ${m.notes}, ${par}, ${par})
    RETURNING id`;
  return id as number;
}

// Sans contenu médical (secrétaire), seule l'identité est modifiée
export async function modifierPatient(id: number, identite: Identite, medical: ContenuMedical | null, par: string) {
  const sql = await base();
  await sql`
    UPDATE patients SET nom = ${identite.nom}, prenom = ${identite.prenom}, sexe = ${identite.sexe},
      naissance = ${identite.naissance}, telephone = ${identite.telephone}, email = ${identite.email},
      cin = ${identite.cin}, adresse = ${identite.adresse}, couverture = ${identite.couverture},
      medecin_traitant = ${identite.medecinTraitant}, modifie_le = now(), modifie_par = ${par}
    WHERE id = ${id}`;
  if (medical) {
    await sql`
      UPDATE patients SET facteurs_risque = ${medical.facteursRisque}, antecedents = ${medical.antecedents},
        allergies = ${medical.allergies}, notes = ${medical.notes}
      WHERE id = ${id}`;
  }
}

export async function supprimerPatient(id: number) {
  const sql = await base();
  await sql`DELETE FROM patients WHERE id = ${id}`;
}

// --- Traitements ---

// En cours d'abord, puis les arrêtés du plus récent au plus ancien
export async function listerTraitements(patientId: number): Promise<Traitement[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT id, medicament, posologie, debut, fin FROM traitements WHERE patient_id = ${patientId}
    ORDER BY fin IS NOT NULL, fin DESC, debut DESC NULLS LAST, id`;
  return lignes as Traitement[];
}

export async function ajouterTraitement(
  patientId: number,
  t: { medicament: string; posologie: string; debut: string | null },
  par: string,
) {
  const sql = await base();
  await sql.transaction([
    sql`INSERT INTO traitements (patient_id, medicament, posologie, debut, cree_par)
        VALUES (${patientId}, ${t.medicament}, ${t.posologie}, ${t.debut}, ${par})`,
    sql`UPDATE patients SET modifie_le = now(), modifie_par = ${par} WHERE id = ${patientId}`,
  ]);
}

// Le patient est rappelé dans chaque requête : un traitement ne peut être modifié que depuis son propre dossier
export async function arreterTraitement(patientId: number, id: number, fin: string, par: string) {
  const sql = await base();
  await sql.transaction([
    sql`UPDATE traitements SET fin = ${fin} WHERE id = ${id} AND patient_id = ${patientId}`,
    sql`UPDATE patients SET modifie_le = now(), modifie_par = ${par} WHERE id = ${patientId}`,
  ]);
}

export async function supprimerTraitement(patientId: number, id: number) {
  const sql = await base();
  await sql`DELETE FROM traitements WHERE id = ${id} AND patient_id = ${patientId}`;
}

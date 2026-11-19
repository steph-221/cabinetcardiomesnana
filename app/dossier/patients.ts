// Dossiers patients : identité, contenu médical de base, traitements.
// Les droits (secrétaire / médecin) sont vérifiés par les actions et les pages qui appellent ces fonctions.

import { numeroInternational } from "../agenda/identite";
import { base } from "./base";
import { estLanguePatient, languesPatient, type LanguePatient } from "./langues-patient";
import type { StatutTabac } from "./mode-de-vie";

export { estLanguePatient, languesPatient, type LanguePatient };

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
  // Langue que parle le patient en consultation : sert à la reconnaissance vocale de sa parole, puis aux messages
  langue: LanguePatient;
};

export type ContenuMedical = {
  facteursRisque: string[];
  antecedents: string;
  allergies: string;
  notes: string;
  // Zone cible de l'INR sous AVK (valve mécanique, FA…), fixée par le médecin
  inrMin: number | null;
  inrMax: number | null;
  // Données de base, saisies dans la fiche et reprises par les calculs (à défaut, la dernière consultation)
  poids: number | null; // kg
  taille: number | null; // cm
  tabac: StatutTabac;
  paquetsAnnees: number | null;
  alcoolVerres: number | null; // verres par semaine
  // Valeurs de référence : repris par les calculs à défaut d'une mesure plus récente (consultation, ETT)
};



export type Patient = Identite &
  ContenuMedical & {
    id: number;
    driveDossier: string | null;
    creeLe: Date;
    creePar: string;
    modifieLe: Date;
    modifiePar: string;
  };

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
  langue: ((l.langue as string | undefined) ?? "") as LanguePatient,
  facteursRisque: l.facteurs_risque as string[],
  antecedents: l.antecedents as string,
  allergies: l.allergies as string,
  notes: l.notes as string,
  inrMin: l.inr_min === null || l.inr_min === undefined ? null : Number(l.inr_min),
  inrMax: l.inr_max === null || l.inr_max === undefined ? null : Number(l.inr_max),
  poids: l.poids === null || l.poids === undefined ? null : Number(l.poids),
  taille: l.taille === null || l.taille === undefined ? null : Number(l.taille),
  tabac: ((l.tabac_statut as string | undefined) ?? "") as StatutTabac,
  paquetsAnnees: l.tabac_paquets_annees === null || l.tabac_paquets_annees === undefined ? null : Number(l.tabac_paquets_annees),
  alcoolVerres: l.alcool_verres === null || l.alcool_verres === undefined ? null : Number(l.alcool_verres),
  driveDossier: (l.drive_dossier as string | null | undefined) ?? null,
  creeLe: l.cree_le as Date,
  creePar: l.cree_par as string,
  modifieLe: l.modifie_le as Date,
  modifiePar: l.modifie_par as string,
});

// Les 9 derniers chiffres suffisent à reconnaître un numéro marocain, qu'il soit saisi 06…, +212 6… ou 00212 6…
export const finTelephone = (telephone: string) => telephone.replace(/\D/g, "").slice(-9);

// Lien WhatsApp vers le patient (numéro marocain 06… / 07… converti au format international)
export function lienWhatsApp(telephone: string) {
  const numero = numeroInternational(telephone);
  return numero ? `https://wa.me/${numero}` : null;
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
  const m = medical ?? { facteursRisque: [], antecedents: "", allergies: "", notes: "", inrMin: null, inrMax: null, poids: null, taille: null, tabac: "" as StatutTabac, paquetsAnnees: null, alcoolVerres: null };
  const [{ id }] = await sql`
    INSERT INTO patients (nom, prenom, sexe, naissance, telephone, email, cin, adresse, couverture, medecin_traitant, langue,
                          facteurs_risque, antecedents, allergies, notes, inr_min, inr_max, poids, taille, tabac_statut,
                          tabac_paquets_annees, alcool_verres, cree_par, modifie_par)
    VALUES (${identite.nom}, ${identite.prenom}, ${identite.sexe}, ${identite.naissance}, ${identite.telephone},
            ${identite.email}, ${identite.cin}, ${identite.adresse}, ${identite.couverture}, ${identite.medecinTraitant},
            ${identite.langue},
            ${m.facteursRisque}, ${m.antecedents}, ${m.allergies}, ${m.notes}, ${m.inrMin}, ${m.inrMax}, ${m.poids},
            ${m.taille}, ${m.tabac}, ${m.paquetsAnnees}, ${m.alcoolVerres},
            ${par}, ${par})
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
      medecin_traitant = ${identite.medecinTraitant}, langue = ${identite.langue}, modifie_le = now(),
      modifie_par = ${par}
    WHERE id = ${id}`;
  if (medical) {
    await sql`
      UPDATE patients SET facteurs_risque = ${medical.facteursRisque}, antecedents = ${medical.antecedents},
        allergies = ${medical.allergies}, notes = ${medical.notes}, inr_min = ${medical.inrMin},
        inr_max = ${medical.inrMax}, poids = ${medical.poids}, taille = ${medical.taille},
        tabac_statut = ${medical.tabac}, tabac_paquets_annees = ${medical.paquetsAnnees},
        alcool_verres = ${medical.alcoolVerres}
      WHERE id = ${id}`;
  }
}

// Poids, taille et mode de vie seulement : mise à jour rapide depuis l'aperçu, sans repasser par tout le formulaire
export type Mesures = Pick<ContenuMedical, "poids" | "taille" | "tabac" | "paquetsAnnees" | "alcoolVerres">;

export async function modifierMesures(id: number, m: Mesures, par: string) {
  const sql = await base();
  await sql`
    UPDATE patients SET poids = ${m.poids}, taille = ${m.taille}, tabac_statut = ${m.tabac},
      tabac_paquets_annees = ${m.paquetsAnnees}, alcool_verres = ${m.alcoolVerres},
      modifie_le = now(), modifie_par = ${par}
    WHERE id = ${id}`;
}

// Ajoute une ligne datée aux notes du dossier (note vocale), sans toucher au reste. Faux si la place manque.
export async function ajouterNote(id: number, ligne: string, par: string) {
  const sql = await base();
  const lignes = await sql`
    UPDATE patients SET notes = CASE WHEN notes = '' THEN ${ligne} ELSE notes || E'\n' || ${ligne} END,
      modifie_le = now(), modifie_par = ${par}
    WHERE id = ${id} AND length(notes) + length(${ligne}) < 5000
    RETURNING id`;
  return lignes.length > 0;
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

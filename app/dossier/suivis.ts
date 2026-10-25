// Suivis à prévoir : prochain contrôle, ETT, Holter, bilan… avec leur échéance, et les relances des patients

import { cabinet } from "../cabinet";
import { base } from "./base";
import { lienWhatsApp } from "./patients";

export const suivisCourants = [
  "Consultation de contrôle",
  "Échocardiographie (ETT)",
  "Holter ECG",
  "MAPA",
  "Épreuve d'effort",
  "INR",
  "Bilan lipidique",
  "Bilan rénal",
  "HbA1c",
];

// Délais proposés pour le prochain suivi, en jours
export const delais = [
  { libelle: "1 semaine", jours: 7 },
  { libelle: "1 mois", jours: 30 },
  { libelle: "3 mois", jours: 91 },
  { libelle: "6 mois", jours: 182 },
  { libelle: "1 an", jours: 365 },
];

export type Statut = "a_faire" | "relance" | "fait";

export type Suivi = {
  id: number;
  patientId: number;
  quoi: string;
  echeance: string; // "AAAA-MM-JJ"
  statut: Statut;
  relanceLe: Date | null;
  relancePar: string | null;
};

export type SuiviPatient = Suivi & { nom: string; prenom: string; sexe: "" | "F" | "M"; telephone: string };

const versSuivi = (l: Record<string, unknown>): SuiviPatient => ({
  id: l.id as number,
  patientId: l.patient_id as number,
  quoi: l.quoi as string,
  echeance: l.echeance as string,
  statut: l.statut as Statut,
  relanceLe: (l.relance_le as Date | null) ?? null,
  relancePar: (l.relance_par as string | null) ?? null,
  nom: (l.nom as string) ?? "",
  prenom: (l.prenom as string) ?? "",
  sexe: ((l.sexe as string) ?? "") as SuiviPatient["sexe"],
  telephone: (l.telephone as string) ?? "",
});

export async function listerSuivisPatient(patientId: number) {
  const sql = await base();
  const lignes = await sql`
    SELECT * FROM suivis WHERE patient_id = ${patientId}
    ORDER BY statut = 'fait', echeance`;
  return lignes.map(versSuivi);
}

// Suivis pas encore faits dont l'échéance tombe avant la date donnée (en retard compris)
export async function suivisAvant(jour: string) {
  const sql = await base();
  const lignes = await sql`
    SELECT s.*, p.nom, p.prenom, p.sexe, p.telephone FROM suivis s JOIN patients p ON p.id = s.patient_id
    WHERE s.statut <> 'fait' AND s.echeance <= ${jour}
    ORDER BY s.echeance, p.nom`;
  return lignes.map(versSuivi);
}

export async function compterEnRetard(aujourdhui: string) {
  const sql = await base();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM suivis WHERE statut <> 'fait' AND echeance < ${aujourdhui}`;
  return n as number;
}

export async function ajouterSuivi(patientId: number, quoi: string, echeance: string, par: string) {
  const sql = await base();
  await sql`INSERT INTO suivis (patient_id, quoi, echeance, cree_par) VALUES (${patientId}, ${quoi}, ${echeance}, ${par})`;
}

export async function changerStatut(patientId: number, id: number, statut: Statut, par: string) {
  const sql = await base();
  await sql`
    UPDATE suivis SET statut = ${statut},
      relance_le = CASE WHEN ${statut} = 'relance' THEN now() ELSE relance_le END,
      relance_par = CASE WHEN ${statut} = 'relance' THEN ${par} ELSE relance_par END
    WHERE id = ${id} AND patient_id = ${patientId}`;
}

export async function supprimerSuivi(patientId: number, id: number) {
  const sql = await base();
  await sql`DELETE FROM suivis WHERE id = ${id} AND patient_id = ${patientId}`;
}

// Patients dont le téléphone correspond (9 derniers chiffres), pour relier les rendez-vous de l'agenda aux dossiers
export async function patientsParTelephone(finsTelephone: string[]) {
  if (!finsTelephone.length) return new Map<string, number>();
  const sql = await base();
  const lignes = await sql`
    SELECT DISTINCT ON (right(telephone_chiffres, 9)) right(telephone_chiffres, 9) AS fin, id FROM patients
    WHERE right(telephone_chiffres, 9) = ANY(${finsTelephone})
    ORDER BY right(telephone_chiffres, 9), modifie_le DESC`;
  return new Map(lignes.map((l) => [l.fin as string, l.id as number]));
}

// Lien WhatsApp avec le message de rappel déjà écrit, que la secrétaire n'a plus qu'à envoyer
export function relanceWhatsApp(s: SuiviPatient) {
  const lien = lienWhatsApp(s.telephone);
  if (!lien) return null;
  const civilite = s.sexe === "F" ? "Madame" : s.sexe === "M" ? "Monsieur" : "";
  const message = [
    `Bonjour ${[civilite, s.nom.toUpperCase()].filter(Boolean).join(" ")},`,
    `le cabinet de cardiologie du ${cabinet.medecin} vous rappelle votre suivi (${s.quoi}), prévu vers le ${s.echeance.split("-").reverse().join("/")}.`,
    `Pour prendre rendez-vous : ${cabinet.telephones.fixe.numero}, ou en ligne sur ${cabinet.site}/fr/rendez-vous`,
  ].join("\n");
  return `${lien}?text=${encodeURIComponent(message)}`;
}

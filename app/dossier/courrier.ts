// Courrier au confrère (médecin traitant) à la suite d'une consultation : un modèle fixe rempli avec le dossier, que le
// médecin relit et corrige avant d'imprimer. Pas d'IA : rien n'est inventé, tout vient de la consultation. Les rubriques
// vides sont simplement omises. Aucun accès à la base ici : module testable seul.

import { cabinet } from "../cabinet";

export type DonneesCourrier = {
  confrere: string; // « Dr Alami » (médecin traitant du dossier), vide si inconnu
  patient: { nom: string; prenom: string; sexe: "" | "F" | "M"; age: number | null };
  date: string; // « AAAA-MM-JJ », date de la consultation
  motif: string;
  antecedents: string;
  traitements: string[];
  examen: string;
  ecg: string;
  echo?: string;
  autres: string;
  conclusion: string;
  conduite: string;
  // Constantes « TA 130/80 mmHg, FC 62 bpm… », déjà mises en forme
  constantes: string;
};

const jour = (d: string) => d.split("-").reverse().join("/");
const propre = (t: string) => t.replace(/[ \t]+/g, " ").trim();

export function civilite(sexe: "" | "F" | "M") {
  return sexe === "F" ? "Madame" : sexe === "M" ? "Monsieur" : "";
}

export function formuleAppel(confrere: string) {
  const nom = propre(confrere);
  if (!nom) return "Cher confrère, chère consœur,";
  return /^(dr|docteur|pr|professeur)\b/i.test(nom) ? `Cher confrère, cher ${nom},`.replace("cher Dr", "cher Docteur") : `Cher confrère, cher Docteur ${nom},`;
}

// Le texte part du dossier ; chaque paragraphe n'existe que si la consultation le renseigne
export function texteCourrier(d: DonneesCourrier): string {
  const nom = [civilite(d.patient.sexe), d.patient.prenom, d.patient.nom.toUpperCase()].filter(Boolean).join(" ");
  const age = d.patient.age !== null ? `, âgé${d.patient.sexe === "F" ? "e" : ""} de ${d.patient.age} ans` : "";
  const paragraphes = [
    formuleAppel(d.confrere),
    `J'ai revu ${nom}${age}, en consultation de cardiologie le ${jour(d.date)}${d.motif ? ` pour : ${propre(d.motif)}` : ""}.`,
    d.antecedents && `Antécédents : ${propre(d.antecedents)}`,
    d.traitements.length ? `Traitement en cours : ${d.traitements.join(" ; ")}.` : "",
    d.constantes && `À l'examen : ${d.constantes}.${d.examen ? ` ${propre(d.examen)}` : ""}`,
    !d.constantes && d.examen && `À l'examen : ${propre(d.examen)}`,
    d.ecg && `ECG : ${propre(d.ecg)}`,
    d.echo && `Échographie cardiaque : ${propre(d.echo)}`,
    d.autres && `Examens complémentaires : ${propre(d.autres)}`,
    d.conclusion && `En conclusion : ${propre(d.conclusion)}`,
    d.conduite && `Conduite à tenir : ${propre(d.conduite)}`,
    "Je reste à votre disposition pour tout renseignement complémentaire.",
    "Confraternellement,",
  ];
  return paragraphes.filter(Boolean).join("\n\n");
}

export const objetCourrier = (nom: { nom: string; prenom: string }, date: string) =>
  `Objet : ${[nom.prenom, nom.nom.toUpperCase()].filter(Boolean).join(" ")} — consultation de cardiologie du ${jour(date)}`;

export const signataire = () => `${cabinet.medecin}\n${cabinet.specialite}`;

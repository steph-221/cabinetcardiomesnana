// Texte des rappels de rendez-vous envoyés aux patients (la veille), et des relances de suivi par e-mail.
// Aucun accès réseau ni base ici : module testable seul.

import { cabinet } from "../cabinet";
import { nomComplet } from "./identite";

const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: cabinet.fuseau });
const heureCourte = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: cabinet.fuseau });

export type Rappel = { prenom?: string; nom: string; debut: Date; medecin?: string; lien: string | null };

export function messageRappel(r: Rappel) {
  const quand = `${dateLongue.format(r.debut)} à ${heureCourte.format(r.debut)}`;
  const sujet = `Rappel : votre rendez-vous du ${dateLongue.format(r.debut)} à ${heureCourte.format(r.debut)}`;
  const texte = [
    `Bonjour ${nomComplet(r.prenom, r.nom.toUpperCase())},`,
    "",
    `Nous vous rappelons votre rendez-vous au cabinet de cardiologie du ${cabinet.medecin} : ${quand}${r.medecin ? ` (Dr ${r.medecin})` : ""}.`,
    "",
    ...(r.lien
      ? [`Pour confirmer ou annuler en un clic : ${r.lien}`, "Si vous annulez, le créneau sera proposé à un autre patient."]
      : [`Pour confirmer ou annuler, appelez le ${cabinet.telephones.fixe.numero} ou le ${cabinet.telephones.mobile.numero}.`]),
    "",
    "Pensez à apporter vos ordonnances, vos derniers examens et votre carte de couverture médicale.",
    `${cabinet.adresse.rue}, ${cabinet.adresse.ville}`,
    "Cordialement,",
    `Le cabinet du ${cabinet.medecin}`,
  ].join("\n");
  return { sujet, texte, quand };
}

export type RelanceSuivi = { prenom?: string; nom: string; sexe: "" | "F" | "M"; quoi: string; echeance: string };

// Même texte pour l'e-mail et le lien WhatsApp préparé (suivis.ts)
export function texteRelance(s: RelanceSuivi) {
  const civilite = s.sexe === "F" ? "Madame" : s.sexe === "M" ? "Monsieur" : "";
  return [
    `Bonjour ${[civilite, s.nom.toUpperCase()].filter(Boolean).join(" ")},`,
    `le cabinet de cardiologie du ${cabinet.medecin} vous rappelle votre suivi (${s.quoi}), prévu vers le ${s.echeance.split("-").reverse().join("/")}.`,
    `Pour prendre rendez-vous : ${cabinet.telephones.fixe.numero}, ou en ligne sur ${cabinet.site}/fr/rendez-vous`,
  ].join("\n");
}

export const sujetRelance = (quoi: string) => `Votre suivi au cabinet de cardiologie : ${quoi}`;

// Message proposé à un patient en attente quand un créneau se libère (liste d'attente). Les créneaux sont déjà mis en
// forme (« jeudi 12 novembre à 10:00 »).
export function messageCreneauLibere(p: { prenom?: string; nom: string }, creneaux: string[]) {
  const liste = creneaux.slice(0, 3).map((c) => `- ${c}`);
  const texte = [
    `Bonjour ${nomComplet(p.prenom, p.nom.toUpperCase())},`,
    "",
    creneaux.length
      ? `Un créneau vient de se libérer au cabinet de cardiologie du ${cabinet.medecin} :`
      : `Un créneau est peut-être disponible au cabinet de cardiologie du ${cabinet.medecin}.`,
    ...liste,
    "",
    `Il est attribué au premier qui répond : appelez le ${cabinet.telephones.fixe.numero} ou le ${cabinet.telephones.mobile.numero}, ou réservez en ligne : ${cabinet.site}/fr/rendez-vous`,
    `Cordialement,`,
    `Le cabinet du ${cabinet.medecin}`,
  ].join("\n");
  return { sujet: "Un créneau s'est libéré au cabinet de cardiologie", texte };
}

// Prévenir le patient quand son rendez-vous change : e-mail et WhatsApp.
// - E-mail : envoi automatique via Resend si RESEND_API_KEY et EMAIL_EXPEDITEUR sont renseignés (voir RESERVATION.md).
// - WhatsApp : envoi automatique via l'API WhatsApp Business (Meta) si WHATSAPP_TOKEN, WHATSAPP_NUMERO_ID et
//   WHATSAPP_MODELE sont renseignés.
// Sans ces réglages, on prépare un lien « mailto: » / « wa.me » avec le message déjà rédigé : la secrétaire
// n'a qu'à l'envoyer.

import { cabinet } from "../cabinet";
import { nomComplet, numeroInternational } from "./identite";
import { messageRappel, type Rappel } from "./rappel";

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: cabinet.fuseau,
});
const heureCourte = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: cabinet.fuseau });

// « mercredi 4 novembre 2026 à 10:00 »
export const quand = (date: Date) => `${dateLongue.format(date)} à ${heureCourte.format(date)}`;

export type Changement = { prenom?: string; nom: string; avant: Date; apres: Date; medecin?: string };

export function messageChangement(c: Changement) {
  const ancien = quand(c.avant);
  const nouveau = quand(c.apres);
  const sujet = `Votre rendez-vous du ${dateLongue.format(c.avant)} est modifié`;
  const texte = [
    `Bonjour ${nomComplet(c.prenom, c.nom.toUpperCase())},`,
    "",
    `Votre rendez-vous du ${ancien} au cabinet de cardiologie du ${cabinet.medecin} est annulé et remplacé par un nouveau rendez-vous :`,
    `${nouveau}${c.medecin ? ` (Dr ${c.medecin})` : ""}.`,
    "",
    `Si cet horaire ne vous convient pas, merci de nous contacter au ${cabinet.telephones.fixe.numero} ou ${cabinet.telephones.mobile.numero}, ou de prendre rendez-vous en ligne : ${cabinet.site}/fr/rendez-vous`,
    "",
    `${cabinet.adresse.rue}, ${cabinet.adresse.ville}`,
    "Cordialement,",
    `Le cabinet du ${cabinet.medecin}`,
  ].join("\n");
  return { sujet, texte, ancien, nouveau };
}

export type Statut = "envoye" | "lien" | "echec" | "absent";

export type Resultat = {
  email: { statut: Statut; adresse?: string; lien?: string };
  whatsapp: { statut: Statut; lien?: string };
};

export const emailConfigure = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_EXPEDITEUR);
const whatsappConfigure = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_NUMERO_ID && process.env.WHATSAPP_MODELE);
// Modèle WhatsApp des rappels, distinct de celui des changements : {{1}} nom, {{2}} date et heure, {{3}} lien ou téléphone
const whatsappRappelConfigure = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_NUMERO_ID && process.env.WHATSAPP_MODELE_RAPPEL);

export async function envoyerEmail(a: string, sujet: string, texte: string) {
  const reponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_EXPEDITEUR,
      to: [a],
      subject: sujet,
      text: texte,
      ...(process.env.EMAIL_REPONSE ? { reply_to: process.env.EMAIL_REPONSE } : {}),
    }),
    cache: "no-store",
  });
  if (!reponse.ok) throw new Error(`E-mail refusé (${reponse.status})`);
}

// Message « modèle » WhatsApp Business : trois variables {{1}} nom, {{2}} ancien rendez-vous, {{3}} nouveau
async function envoyerWhatsApp(numero: string, variables: string[], modele = process.env.WHATSAPP_MODELE) {
  const reponse = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_NUMERO_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: numero,
      type: "template",
      template: {
        name: modele,
        language: { code: process.env.WHATSAPP_LANGUE || "fr" },
        components: [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }],
      },
    }),
    cache: "no-store",
  });
  if (!reponse.ok) throw new Error(`WhatsApp refusé (${reponse.status})`);
}

// Prévient le patient par les canaux demandés. Ne lève jamais d'erreur : le rendez-vous est déjà modifié,
// le résultat dit simplement ce qui est parti (ou le lien à ouvrir à la main).
export async function prevenirPatient(
  c: Changement,
  contact: { email?: string; telephone?: string },
  canaux: { email: boolean; whatsapp: boolean },
): Promise<Resultat> {
  const { sujet, texte, ancien, nouveau } = messageChangement(c);
  const resultat: Resultat = { email: { statut: "absent" }, whatsapp: { statut: "absent" } };

  if (canaux.email && contact.email) {
    resultat.email = { statut: "lien", adresse: contact.email };
    if (emailConfigure()) {
      try {
        await envoyerEmail(contact.email, sujet, texte);
        resultat.email.statut = "envoye";
      } catch (erreur) {
        console.error(erreur);
        resultat.email.statut = "echec";
      }
    }
    if (resultat.email.statut !== "envoye") {
      resultat.email.lien = `mailto:${contact.email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(texte)}`;
    }
  }

  const numero = canaux.whatsapp && contact.telephone ? numeroInternational(contact.telephone) : null;
  if (numero) {
    resultat.whatsapp = { statut: "lien" };
    if (whatsappConfigure()) {
      try {
        await envoyerWhatsApp(numero, [nomComplet(c.prenom, c.nom.toUpperCase()), ancien, nouveau]);
        resultat.whatsapp.statut = "envoye";
      } catch (erreur) {
        console.error(erreur);
        resultat.whatsapp.statut = "echec";
      }
    }
    if (resultat.whatsapp.statut !== "envoye") {
      resultat.whatsapp.lien = `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
    }
  }
  return resultat;
}

// Rappel de rendez-vous : e-mail automatique si Resend est configuré, WhatsApp automatique si le modèle de rappel est
// approuvé par Meta (WHATSAPP_MODELE_RAPPEL) ; sinon, lien à envoyer à la main. Ne lève jamais d'erreur.
export async function rappelerPatient(
  r: Rappel,
  contact: { email?: string; telephone?: string },
  canaux: { email: boolean; whatsapp: boolean } = { email: true, whatsapp: true },
): Promise<Resultat> {
  const { sujet, texte, quand } = messageRappel(r);
  const resultat: Resultat = { email: { statut: "absent" }, whatsapp: { statut: "absent" } };

  if (canaux.email && contact.email) {
    resultat.email = { statut: "lien", adresse: contact.email };
    if (emailConfigure()) {
      try {
        await envoyerEmail(contact.email, sujet, texte);
        resultat.email.statut = "envoye";
      } catch (erreur) {
        console.error(erreur);
        resultat.email.statut = "echec";
      }
    }
    if (resultat.email.statut !== "envoye") {
      resultat.email.lien = `mailto:${contact.email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(texte)}`;
    }
  }

  const numero = canaux.whatsapp && contact.telephone ? numeroInternational(contact.telephone) : null;
  if (numero) {
    resultat.whatsapp = { statut: "lien" };
    if (whatsappRappelConfigure()) {
      try {
        await envoyerWhatsApp(
          numero,
          [nomComplet(r.prenom, r.nom.toUpperCase()), quand, r.lien ?? cabinet.telephones.fixe.numero],
          process.env.WHATSAPP_MODELE_RAPPEL,
        );
        resultat.whatsapp.statut = "envoye";
      } catch (erreur) {
        console.error(erreur);
        resultat.whatsapp.statut = "echec";
      }
    }
    if (resultat.whatsapp.statut !== "envoye") {
      resultat.whatsapp.lien = `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
    }
  }
  return resultat;
}

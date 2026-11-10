"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import { lireRendezvous, marquerRendezvous } from "../../../agenda/google";
import { lienRdv } from "../../../agenda/lien-patient";
import { rappelerPatient, type Resultat } from "../../../agenda/notification";
import { baseConfiguree } from "../../../dossier/base";
import { journaliser } from "../../../dossier/journal";

// Prépare (ou envoie, si l'envoi automatique est configuré) le rappel d'un rendez-vous, puis le marque comme rappelé.
// Le résultat donne les liens e-mail / WhatsApp à ouvrir quand rien n'est parti tout seul.
export async function preparerRappel(langue: string, id: string): Promise<Resultat | { erreur: string }> {
  const utilisateur = await exigerUtilisateur(langue);
  try {
    const rdv = await lireRendezvous(id);
    if (rdv.fermeture || rdv.debut.length === 10) return { erreur: "Ce n'est pas un rendez-vous patient." };
    const resultat = await rappelerPatient(
      { prenom: rdv.prenom, nom: rdv.nom, debut: new Date(rdv.debut), medecin: rdv.medecin, lien: lienRdv(id) },
      { email: rdv.email, telephone: rdv.telephone },
    );
    if (resultat.email.statut === "absent" && resultat.whatsapp.statut === "absent") {
      return { erreur: "Aucune adresse e-mail ni numéro valide pour ce patient." };
    }
    await marquerRendezvous(id, { rappelLe: new Date().toISOString() });
    if (baseConfiguree()) await journaliser(utilisateur.identifiant, "rappel de rendez-vous préparé", rdv.patientId ?? null, rdv.titre).catch(console.error);
    refresh();
    return resultat;
  } catch (erreur) {
    console.error(erreur);
    return { erreur: "Le rappel n'a pas pu être préparé. Réessayez dans un instant." };
  }
}

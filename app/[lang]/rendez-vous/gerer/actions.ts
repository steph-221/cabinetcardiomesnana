"use server";

import { lireRendezvous, marquerRendezvous, supprimerRendezvous } from "../../../agenda/google";
import { signatureValide } from "../../../agenda/lien-patient";
import { baseConfiguree } from "../../../dossier/base";
import { journaliser } from "../../../dossier/journal";

export type EtatLien = { statut: "confirme" | "annule" | "erreur"; message: string } | null;

// Réponse du patient depuis son lien personnel : confirmer ou annuler. La signature du lien est revérifiée ici.
export async function repondre(_: EtatLien, formData: FormData): Promise<EtatLien> {
  const id = String(formData.get("r") ?? "");
  const signature = String(formData.get("t") ?? "");
  const choix = String(formData.get("choix") ?? "");
  if (!signatureValide(id, signature)) return { statut: "erreur", message: "Ce lien n'est plus valide. Appelez le cabinet." };
  try {
    const rdv = await lireRendezvous(id);
    if (!rdv.annulable || rdv.fermeture || rdv.debut.length === 10) {
      return { statut: "erreur", message: "Ce rendez-vous ne peut pas être modifié en ligne. Appelez le cabinet." };
    }
    if (new Date(rdv.debut).getTime() < Date.now()) return { statut: "erreur", message: "Ce rendez-vous est déjà passé." };
    if (choix === "annuler") {
      await supprimerRendezvous(id);
      if (baseConfiguree()) await journaliser("patient", "rendez-vous annulé par le patient", rdv.patientId ?? null, rdv.titre).catch(console.error);
      return { statut: "annule", message: "Votre rendez-vous est annulé. Le créneau est libéré." };
    }
    await marquerRendezvous(id, { confirme: new Date().toISOString() });
    if (baseConfiguree()) await journaliser("patient", "rendez-vous confirmé par le patient", rdv.patientId ?? null, rdv.titre).catch(console.error);
    return { statut: "confirme", message: "Merci, votre rendez-vous est confirmé. À bientôt au cabinet." };
  } catch (erreur) {
    console.error(erreur);
    return { statut: "erreur", message: "Ce rendez-vous n'existe plus ou n'a pas pu être modifié. Appelez le cabinet." };
  }
}

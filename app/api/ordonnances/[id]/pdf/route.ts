// Ordonnance en PDF, médecins seulement

import { accesMedical, utilisateurConnecte } from "../../../../agenda/session";
import { journaliser } from "../../../../dossier/journal";
import { lireOrdonnance } from "../../../../dossier/ordonnances";
import { lirePatient } from "../../../../dossier/patients";
import { lireImpression } from "../../../../dossier/impression";
import { pdfOrdonnance } from "../../../../dossier/pdf";
import { nomFichier, reponsePdf } from "../../../../dossier/reponse-pdf";

export async function GET(requete: Request, ctx: RouteContext<"/api/ordonnances/[id]/pdf">) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });
  const id = Number((await ctx.params).id);
  const ordonnance = Number.isInteger(id) ? await lireOrdonnance(id) : null;
  const patient = ordonnance ? await lirePatient(ordonnance.patientId) : null;
  if (!ordonnance || !patient) return new Response("Ordonnance introuvable.", { status: 404 });
  await journaliser(utilisateur.identifiant, "ordonnance imprimée", patient.id, ordonnance.date);
  const demande = new URL(requete.url).searchParams;
  const options = lireImpression(demande.get("format"), demande.get("entete"));
  return reponsePdf(await pdfOrdonnance(ordonnance, patient, options), nomFichier("Ordonnance", patient, ordonnance.date));
}

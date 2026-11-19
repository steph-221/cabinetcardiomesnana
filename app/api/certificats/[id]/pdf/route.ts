// Certificat médical en PDF (A5 par défaut, ?format=A4), médecins seulement

import { accesMedical, utilisateurConnecte } from "../../../../agenda/session";
import { lireCertificat } from "../../../../dossier/certificats";
import { journaliser } from "../../../../dossier/journal";
import { lirePatient } from "../../../../dossier/patients";
import { lireImpression } from "../../../../dossier/impression";
import { pdfCertificat } from "../../../../dossier/pdf";
import { nomFichier, reponsePdf } from "../../../../dossier/reponse-pdf";

export async function GET(requete: Request, ctx: RouteContext<"/api/certificats/[id]/pdf">) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });
  const id = Number((await ctx.params).id);
  const certificat = Number.isInteger(id) ? await lireCertificat(id) : null;
  const patient = certificat ? await lirePatient(certificat.patientId) : null;
  if (!certificat || !patient) return new Response("Certificat introuvable.", { status: 404 });
  const demande = new URL(requete.url).searchParams;
  const options = lireImpression(demande.get("format"), demande.get("entete"));
  await journaliser(utilisateur.identifiant, "certificat imprimé", patient.id, certificat.date);
  return reponsePdf(await pdfCertificat(certificat, patient, options), nomFichier("Certificat", patient, certificat.date));
}

// Certificat médical en PDF (A5 par défaut, ?format=A4), médecins seulement

import { accesMedical, utilisateurConnecte } from "../../../../agenda/session";
import { lireCertificat } from "../../../../dossier/certificats";
import { journaliser } from "../../../../dossier/journal";
import { lirePatient } from "../../../../dossier/patients";
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
  const format = new URL(requete.url).searchParams.get("format") === "A4" ? "A4" : "A5";
  await journaliser(utilisateur.identifiant, "certificat imprimé", patient.id, certificat.date);
  return reponsePdf(await pdfCertificat(certificat, patient, format), nomFichier("Certificat", patient, certificat.date));
}

// Rapport de consultation en PDF, médecins seulement (toujours à jour : regénéré à chaque ouverture)

import { accesMedical, utilisateurConnecte } from "../../../../agenda/session";
import { lireConsultationSeule } from "../../../../dossier/consultations";
import { journaliser } from "../../../../dossier/journal";
import { listerTraitements, lirePatient } from "../../../../dossier/patients";
import { pdfConsultation } from "../../../../dossier/pdf";
import { nomFichier, reponsePdf } from "../../../../dossier/reponse-pdf";

export async function GET(_: Request, ctx: RouteContext<"/api/consultations/[id]/pdf">) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });
  const id = Number((await ctx.params).id);
  const consultation = Number.isInteger(id) ? await lireConsultationSeule(id) : null;
  const patient = consultation ? await lirePatient(consultation.patientId) : null;
  if (!consultation || !patient) return new Response("Consultation introuvable.", { status: 404 });
  // Traitements en cours à la date de la consultation
  const traitements = (await listerTraitements(patient.id))
    .filter((t) => (!t.debut || t.debut <= consultation.date) && (!t.fin || t.fin > consultation.date))
    .map((t) => [t.medicament, t.posologie].filter(Boolean).join(" — "));
  await journaliser(utilisateur.identifiant, "rapport de consultation imprimé", patient.id, consultation.date);
  return reponsePdf(
    await pdfConsultation(consultation, patient, traitements),
    nomFichier("Consultation", patient, consultation.date),
  );
}

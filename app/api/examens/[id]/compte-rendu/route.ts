// Compte rendu (ETT, ECG, MAPA, épreuve d'effort) saisi sur le site, en PDF, médecins seulement

import { accesMedical, utilisateurConnecte } from "../../../../agenda/session";
import type { DonneesExamen } from "../../../../dossier/comptes-rendus/types";
import type { DonneesETT } from "../../../../dossier/ett";
import { lireExamen } from "../../../../dossier/examens";
import { journaliser } from "../../../../dossier/journal";
import { lirePatient } from "../../../../dossier/patients";
import { pdfCompteRendu, pdfETT } from "../../../../dossier/pdf";
import { nomFichier, reponsePdf } from "../../../../dossier/reponse-pdf";

export async function GET(_: Request, ctx: RouteContext<"/api/examens/[id]/compte-rendu">) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });
  const id = Number((await ctx.params).id);
  const examen = Number.isInteger(id) ? await lireExamen(id) : null;
  const ett = examen?.valeurs.ett as DonneesETT | undefined;
  const cr = examen?.valeurs.cr as DonneesExamen | undefined;
  const patient = examen && (ett || cr) ? await lirePatient(examen.patientId) : null;
  if (!examen || !(ett || cr) || !patient) return new Response("Compte rendu introuvable.", { status: 404 });
  if (cr) {
    await journaliser(utilisateur.identifiant, `compte rendu ${examen.type} imprimé`, patient.id, examen.date);
    return reponsePdf(await pdfCompteRendu(cr, examen.date, patient), nomFichier(examen.type, patient, examen.date));
  }
  await journaliser(utilisateur.identifiant, "compte rendu d'ETT imprimé", patient.id, examen.date);
  return reponsePdf(await pdfETT(ett!, examen.date, patient), nomFichier("ETT", patient, examen.date));
}

// Courrier au confrère en PDF, à partir du texte relu et corrigé par le médecin. Médecins seulement.

import { jourLocal } from "../../../agenda/creneaux";
import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { journaliser } from "../../../dossier/journal";
import { lirePatient } from "../../../dossier/patients";
import { pdfCourrier } from "../../../dossier/pdf";
import { nomFichier, reponsePdf } from "../../../dossier/reponse-pdf";

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });
  const f = await request.formData().catch(() => null);
  if (!f) return new Response("Envoi incomplet.", { status: 400 });
  const champ = (nom: string, max: number) => String(f.get(nom) ?? "").trim().slice(0, max);
  const patient = await lirePatient(Number(champ("patient", 12)));
  const texte = champ("texte", 8000);
  if (!patient || !texte) return new Response("Courrier vide ou dossier introuvable.", { status: 400 });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(champ("date", 10)) ? champ("date", 10) : jourLocal(new Date());
  await journaliser(utilisateur.identifiant, "courrier au confrère imprimé", patient.id, date);
  return reponsePdf(
    await pdfCourrier({ date: jourLocal(new Date()), destinataire: champ("destinataire", 150), objet: champ("objet", 250), texte }),
    nomFichier("Courrier", patient, date),
  );
}

// Ajout d'un examen avec son fichier (PDF ou photo), rangé dans le dossier Drive du patient.
// Une route plutôt qu'une action : les actions sont limitées à 1 Mo, et Vercel accepte jusqu'à 4,5 Mo.

import { estJour } from "../../agenda/creneaux";
import { accesMedical, utilisateurConnecte } from "../../agenda/session";
import { compteDrive, envoyerExamen, expliquerErreurDrive, mettreALaCorbeille } from "../../dossier/drive";
import { ajouterExamen, TAILLE_MAX, typesExamen, typesFichier } from "../../dossier/examens";
import { journaliser } from "../../dossier/journal";
import { lirePatient } from "../../dossier/patients";

const erreur = (message: string, status: number) => Response.json({ erreur: message }, { status });

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return erreur("Session expirée : reconnectez-vous.", 401);

  const formulaire = await request.formData().catch(() => null);
  if (!formulaire) return erreur("Envoi incomplet.", 400);
  const patientId = Number(formulaire.get("patient"));
  const type = String(formulaire.get("type") ?? "");
  const date = String(formulaire.get("date") ?? "");
  // La secrétaire classe les examens ; seuls les médecins écrivent une conclusion
  const conclusion = accesMedical(utilisateur) ? String(formulaire.get("conclusion") ?? "").trim().slice(0, 5000) : "";
  const fichier = formulaire.get("fichier");

  if (!typesExamen.includes(type) || !estJour(date)) return erreur("Indiquez le type et la date de l'examen.", 400);
  if (!(fichier instanceof File) || fichier.size === 0) return erreur("Aucun fichier reçu.", 400);
  if (!typesFichier.includes(fichier.type)) return erreur("Seuls les PDF et les photos sont acceptés.", 400);
  if (fichier.size > TAILLE_MAX) return erreur("Le fichier dépasse 4 Mo.", 413);

  const patient = Number.isInteger(patientId) ? await lirePatient(patientId) : null;
  if (!patient) return erreur("Dossier introuvable.", 404);
  if (!(await compteDrive())) return erreur("Google Drive n'est pas connecté (voir l'espace administrateur).", 503);

  let drive: string;
  try {
    drive = await envoyerExamen(patient, `${date} ${type} — ${fichier.name}`, fichier);
  } catch (e) {
    console.error(e);
    return erreur(expliquerErreurDrive(e), 502);
  }
  try {
    const id = await ajouterExamen(
      patient.id,
      { type, date, conclusion, fichier: { drive, nom: fichier.name, type: fichier.type, taille: fichier.size } },
      utilisateur.identifiant,
    );
    await journaliser(utilisateur.identifiant, "examen ajouté", patient.id, `${type} du ${date}`);
    return Response.json({ id });
  } catch (e) {
    console.error(e);
    // Le fichier ne serait rattaché à aucun examen : il repart à la corbeille du Drive
    await mettreALaCorbeille(drive).catch(console.error);
    return erreur("L'examen n'a pas pu être enregistré dans la base. Réessayez dans un instant.", 500);
  }
}

// Ouverture du fichier d'un examen : lu dans Google Drive et transmis au navigateur, médecins seulement.
// Le personnel n'a ainsi besoin d'aucun accès au Drive du cabinet.

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { lireFichier } from "../../../dossier/drive";
import { lireExamen, typesFichier } from "../../../dossier/examens";
import { journaliser } from "../../../dossier/journal";

export async function GET(_: Request, ctx: RouteContext<"/api/fichiers/[id]">) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });

  const id = Number((await ctx.params).id);
  const examen = Number.isInteger(id) ? await lireExamen(id) : null;
  if (!examen?.fichierDrive) return new Response("Fichier introuvable.", { status: 404 });

  let reponse: Response;
  try {
    reponse = await lireFichier(examen.fichierDrive);
  } catch (erreur) {
    console.error(erreur);
    return new Response("Google Drive ne répond pas. Réessayez dans un instant.", { status: 502 });
  }
  await journaliser(utilisateur.identifiant, "examen ouvert", examen.patientId, `${examen.type} du ${examen.date}`);

  // Seuls les PDF et les photos s'affichent dans le navigateur ; tout autre fichier est téléchargé
  const affichable = typesFichier.includes(examen.fichierType);
  return new Response(reponse.body, {
    headers: {
      "Content-Type": affichable ? examen.fichierType : "application/octet-stream",
      "Content-Disposition": `${affichable ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(examen.fichierNom)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}

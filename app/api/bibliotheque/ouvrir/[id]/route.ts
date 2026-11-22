// Ouverture d'une copie privée (page ou fichier d'un site suivi), lue dans le Google Drive du cabinet. Médecins
// seulement. La page copiée s'affiche sans aucun script ; un gros fichier s'ouvre directement dans Google Drive.

import { accesMedical, utilisateurConnecte } from "../../../../agenda/session";
import { lireCopie } from "../../../../dossier/copies";
import { lienDrive, lireFichier } from "../../../../dossier/drive";

// Au-delà, la réponse dépasserait ce que le site peut transmettre : le fichier s'ouvre dans Google Drive
const TAILLE_TRANSMISE = 4_000_000;
const affichables = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain", "text/csv"];

export async function GET(_: Request, ctx: RouteContext<"/api/bibliotheque/ouvrir/[id]">) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });

  const id = Number((await ctx.params).id);
  const copie = Number.isInteger(id) && id > 0 ? await lireCopie(id) : null;
  if (!copie) return new Response("Copie introuvable.", { status: 404 });
  if (copie.taille > TAILLE_TRANSMISE) return Response.redirect(lienDrive(copie.driveId), 302);

  let reponse: Response;
  try {
    reponse = await lireFichier(copie.driveId);
  } catch (erreur) {
    console.error(erreur);
    return new Response("Google Drive ne répond pas. Réessayez dans un instant.", { status: 502 });
  }

  const page = copie.genre === "page";
  const affichable = page || affichables.includes(copie.mime);
  const nom = page ? `${copie.titre}.html` : copie.titre;
  return new Response(reponse.body, {
    headers: {
      "Content-Type": page ? "text/html; charset=utf-8" : affichable ? copie.mime : "application/octet-stream",
      "Content-Disposition": `${affichable ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      // Aucun script, aucun formulaire : la copie s'affiche dans un bac à sable, sans accès au site du cabinet
      "Content-Security-Policy":
        "sandbox allow-popups allow-popups-to-escape-sandbox; script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'",
    },
  });
}

// Ouverture d'un résultat reçu par email et pas encore confirmé, pour vérifier à quel patient il appartient.
// Tout le personnel connecté peut l'ouvrir : sans cela, la secrétaire ne pourrait pas le classer.

import { utilisateurConnecte } from "../../../agenda/session";
import { typesFichier } from "../../../dossier/examens";
import { journaliser } from "../../../dossier/journal";
import { lireContenuResultat } from "../../../dossier/resultats";

export async function GET(_: Request, ctx: RouteContext<"/api/resultats/[id]">) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  const id = Number((await ctx.params).id);
  const r = Number.isInteger(id) ? await lireContenuResultat(id) : null;
  if (!r) return new Response("Fichier introuvable.", { status: 404 });
  await journaliser(utilisateur.identifiant, "résultat reçu par email ouvert", null, String(id));
  const affichable = typesFichier.includes(r.type);
  return new Response(new Uint8Array(r.contenu), {
    headers: {
      "Content-Type": affichable ? r.type : "application/octet-stream",
      "Content-Disposition": `${affichable ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.nom)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}

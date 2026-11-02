// Copie privée des sites suivis : traite un lot de la file (environ 35 secondes), à la demande de la page
// « Sites et revues suivis », qui relance un lot tant qu'il reste des adresses. Médecins seulement.

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { copierUnLot } from "../../../dossier/copie-lot";
import { compteDrive, driveConfigure } from "../../../dossier/drive";

// Le navigateur sans fenêtre et les gros PDF demandent du temps : un lot s'arrête de lui-même après 35 secondes (le lot en cours se termine avant)
export const maxDuration = 300;

export async function POST(request: Request) {
  // Seule la page du site peut lancer une copie (pas un autre site ouvert dans le navigateur)
  const provenance = request.headers.get("sec-fetch-site");
  if (provenance && provenance !== "same-origin") return new Response("Requête refusée.", { status: 403 });
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });

  const corps = (await request.json().catch(() => null)) as { site?: unknown } | null;
  const site = Number(corps?.site);
  if (!Number.isInteger(site) || site <= 0) return new Response("Site inconnu.", { status: 400 });
  if (!driveConfigure() || !(await compteDrive())) {
    return Response.json({
      erreur: "Google Drive n'est pas connecté : l'administrateur doit le connecter (page Google Drive).",
    });
  }
  try {
    return Response.json(await copierUnLot(site));
  } catch (erreur) {
    console.error(erreur);
    return Response.json({ erreur: "La copie s'est interrompue. Réessayez dans un instant." });
  }
}

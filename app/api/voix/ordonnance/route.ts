// Ordonnance dictée : découpage par Claude quand le découpage automatique du navigateur laisse des lignes douteuses.
// Seul le texte dicté est transmis (ni nom ni identité du patient). Médecins seulement.

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { claudeConfigure } from "../../../dossier/dictee";
import { decouperOrdonnanceIA } from "../../../dossier/note-vocale-ia";

export const maxDuration = 60;

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ erreur: "Session expirée : reconnectez-vous." }, { status: 401 });
  if (!accesMedical(utilisateur)) return Response.json({ erreur: "Réservé aux médecins." }, { status: 403 });
  if (!claudeConfigure()) return Response.json({ erreur: "Claude n'est pas configuré (voir DOSSIER.md)." }, { status: 503 });

  const { texte } = (await request.json().catch(() => ({}))) as { texte?: unknown };
  if (typeof texte !== "string" || !texte.trim()) return Response.json({ erreur: "Rien n'a été dicté." }, { status: 400 });
  if (texte.length > 4000) return Response.json({ erreur: "Dictée trop longue." }, { status: 413 });
  try {
    return Response.json({ lignes: await decouperOrdonnanceIA(texte.trim()) });
  } catch (erreur) {
    console.error(erreur);
    return Response.json({ erreur: "Claude n'a pas pu découper l'ordonnance. Corrigez les lignes à la main." }, { status: 502 });
  }
}

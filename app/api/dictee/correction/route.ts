// Amélioration de la dictée par Claude (facultative), médecins seulement.
// Seul le texte dicté est transmis (ni nom ni identité du patient).

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { claudeConfigure, corriger } from "../../../dossier/dictee";
import { journaliser } from "../../../dossier/journal";
import { lireLexique } from "../../../dossier/lexique";

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ erreur: "Session expirée : reconnectez-vous." }, { status: 401 });
  if (!accesMedical(utilisateur)) return Response.json({ erreur: "Réservé aux médecins." }, { status: 403 });
  if (!claudeConfigure()) {
    return Response.json({ erreur: "Claude n'est pas configuré (voir DOSSIER.md)." }, { status: 503 });
  }

  const { texte } = (await request.json().catch(() => ({}))) as { texte?: unknown };
  if (typeof texte !== "string" || !texte.trim()) return Response.json({ erreur: "Rien à corriger." }, { status: 400 });
  if (texte.length > 20_000) return Response.json({ erreur: "Dictée trop longue." }, { status: 413 });
  try {
    const correction = await corriger(texte.trim(), await lireLexique());
    await journaliser(utilisateur.identifiant, "dictée améliorée par Claude", null, `${texte.length} caractères`);
    return Response.json(correction);
  } catch (erreur) {
    console.error(erreur);
    return Response.json(
      { erreur: "Claude n'a pas pu améliorer la dictée. La correction gratuite reste affichée." },
      { status: 502 },
    );
  }
}

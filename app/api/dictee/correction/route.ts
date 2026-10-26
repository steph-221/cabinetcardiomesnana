// Correction de la transcription et rangement par rubrique, médecins seulement.
// Seul le texte dicté est transmis (ni nom ni identité du patient).

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { corriger, dicteeConfiguree } from "../../../dossier/dictee";
import { journaliser } from "../../../dossier/journal";
import { lireLexique } from "../../../dossier/lexique";

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ erreur: "Session expirée : reconnectez-vous." }, { status: 401 });
  if (!accesMedical(utilisateur)) return Response.json({ erreur: "Réservé aux médecins." }, { status: 403 });
  if (!dicteeConfiguree())
    return Response.json({ erreur: "La dictée n'est pas configurée (voir DOSSIER.md)." }, { status: 503 });

  const { texte } = (await request.json().catch(() => ({}))) as { texte?: unknown };
  if (typeof texte !== "string" || !texte.trim()) return Response.json({ erreur: "Rien à corriger." }, { status: 400 });
  if (texte.length > 20_000) return Response.json({ erreur: "Dictée trop longue." }, { status: 413 });
  try {
    const correction = await corriger(texte.trim(), await lireLexique());
    await journaliser(utilisateur.identifiant, "dictée corrigée", null, `${texte.length} caractères`);
    return Response.json(correction);
  } catch (erreur) {
    console.error(erreur);
    return Response.json(
      { erreur: "La correction automatique n'a pas abouti. Le texte brut reste disponible." },
      { status: 502 },
    );
  }
}

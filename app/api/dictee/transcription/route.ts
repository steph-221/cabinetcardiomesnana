// Transcription d'un morceau de dictée (WAV 16 kHz mono, moins d'une minute), médecins seulement.
// L'audio est transmis à Google puis oublié : il n'est enregistré nulle part.

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { dicteeConfiguree, transcrire } from "../../../dossier/dictee";
import { lireLexique } from "../../../dossier/lexique";

const TAILLE_MAX = 2.5 * 1024 * 1024; // 50 s d'audio 16 kHz mono ≈ 1,6 Mo

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ erreur: "Session expirée : reconnectez-vous." }, { status: 401 });
  if (!accesMedical(utilisateur)) return Response.json({ erreur: "Réservé aux médecins." }, { status: 403 });
  if (!dicteeConfiguree())
    return Response.json({ erreur: "La dictée n'est pas configurée (voir DOSSIER.md)." }, { status: 503 });

  const audio = await request.arrayBuffer();
  if (!audio.byteLength || audio.byteLength > TAILLE_MAX) {
    return Response.json({ erreur: "Morceau d'audio vide ou trop long." }, { status: 413 });
  }
  try {
    const lexique = await lireLexique();
    return Response.json({
      texte: await transcrire(
        audio,
        lexique.map((l) => l.correct),
      ),
    });
  } catch (erreur) {
    console.error(erreur);
    return Response.json({ erreur: "La reconnaissance vocale n'a pas répondu. Réessayez." }, { status: 502 });
  }
}

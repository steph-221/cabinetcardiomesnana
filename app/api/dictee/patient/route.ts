// Parole du patient pendant la consultation (arabe ou français), transcrite par le navigateur : Claude la rapporte
// en français dans les rubriques du rapport. Seule la transcription est transmise, sans nom ni identité.
// Médecins seulement ; le médecin relit avant toute insertion.

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { claudeConfigure, rapporterPatient } from "../../../dossier/dictee";
import { journaliser } from "../../../dossier/journal";

export const maxDuration = 60;

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ erreur: "Session expirée : reconnectez-vous." }, { status: 401 });
  if (!accesMedical(utilisateur)) return Response.json({ erreur: "Réservé aux médecins." }, { status: 403 });
  if (!claudeConfigure()) {
    return Response.json({ erreur: "Claude n'est pas configuré (voir DOSSIER.md)." }, { status: 503 });
  }

  const { texte, langue, superieur } = (await request.json().catch(() => ({}))) as {
    texte?: unknown;
    langue?: unknown;
    superieur?: unknown;
  };
  if (typeof texte !== "string" || !texte.trim()) return Response.json({ erreur: "Rien n'a été reconnu." }, { status: 400 });
  if (texte.length > 20_000) return Response.json({ erreur: "Enregistrement trop long." }, { status: 413 });
  try {
    const correction = await rapporterPatient(texte.trim(), langue === "ar" ? "ar" : "fr", superieur === true);
    await journaliser(utilisateur.identifiant, "parole du patient rapportée par Claude", null, `${texte.length} caractères`);
    return Response.json(correction);
  } catch (erreur) {
    console.error(erreur);
    return Response.json({ erreur: "Claude n'a pas pu rapporter la parole du patient. Réessayez." }, { status: 502 });
  }
}

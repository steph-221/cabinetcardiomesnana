// Rédaction d'un compte rendu par Claude à partir d'une dictée, médecins seulement.
// Seul le texte dicté et un résumé clinique sans nom ni coordonnées sont transmis.

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { claudeConfigure } from "../../../dossier/dictee";
import { journaliser } from "../../../dossier/journal";
import { rediger, typesRedaction } from "../../../dossier/redaction";
import { resumeClinique } from "../../../dossier/questions";

export const maxDuration = 120;

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ erreur: "Session expirée : reconnectez-vous." }, { status: 401 });
  if (!accesMedical(utilisateur)) return Response.json({ erreur: "Réservé aux médecins." }, { status: 403 });
  if (!claudeConfigure()) {
    return Response.json({ erreur: "Claude n'est pas configuré (voir DOSSIER.md)." }, { status: 503 });
  }

  const { type, texte, patient, superieur } = (await request.json().catch(() => ({}))) as {
    type?: unknown;
    texte?: unknown;
    patient?: unknown;
    superieur?: unknown;
  };
  if (typeof type !== "string" || !typesRedaction.includes(type)) {
    return Response.json({ erreur: "Choisissez le type d'examen." }, { status: 400 });
  }
  if (typeof texte !== "string" || texte.trim().length < 10) {
    return Response.json({ erreur: "Dictez ou saisissez les résultats de l'examen." }, { status: 400 });
  }
  if (texte.length > 10_000) return Response.json({ erreur: "Dictée trop longue." }, { status: 413 });
  const patientId = typeof patient === "number" && Number.isInteger(patient) && patient > 0 ? patient : null;
  try {
    const contexte = patientId ? await resumeClinique(patientId) : null;
    const resultat = await rediger(type, texte.trim(), contexte, superieur === true);
    await journaliser(utilisateur.identifiant, "compte rendu rédigé par Claude", patientId, type);
    return Response.json(resultat);
  } catch (erreur) {
    console.error(erreur);
    return Response.json({ erreur: "Claude n'a pas pu rédiger le compte rendu. Réessayez dans un instant." }, { status: 502 });
  }
}

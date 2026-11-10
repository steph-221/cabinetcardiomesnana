// Note vocale : actions proposées par Claude à partir d'une dictée libre, médecins seulement.
// Le nom du patient, sa date de naissance et les téléphones sont masqués avant l'envoi.

import { jourLocal } from "../../../agenda/creneaux";
import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { claudeConfigure } from "../../../dossier/dictee";
import { journaliser } from "../../../dossier/journal";
import type { ActionNote } from "../../../dossier/note-vocale";
import { proposerActions } from "../../../dossier/note-vocale-ia";
import { libellePatient, lirePatient } from "../../../dossier/patients";
import { masquer } from "../../../dossier/reprise";

export const maxDuration = 60;

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ erreur: "Session expirée : reconnectez-vous." }, { status: 401 });
  if (!accesMedical(utilisateur)) return Response.json({ erreur: "Réservé aux médecins." }, { status: 403 });

  const { texte, patient, superieur } = (await request.json().catch(() => ({}))) as {
    texte?: unknown;
    patient?: unknown;
    superieur?: unknown;
  };
  if (typeof texte !== "string" || !texte.trim()) return Response.json({ erreur: "Rien n'a été dicté." }, { status: 400 });
  if (texte.length > 6000) return Response.json({ erreur: "Note trop longue." }, { status: 413 });
  const patientId = typeof patient === "number" && Number.isInteger(patient) && patient > 0 ? patient : null;
  const dicte = texte.trim();

  // Sans Claude : la dictée devient une simple note, que le médecin peut ranger lui-même
  const simple: ActionNote[] = [{ type: "note", texte: dicte.slice(0, 2000) }];
  if (!claudeConfigure()) return Response.json({ actions: simple, parClaude: false });

  try {
    const dossier = patientId ? await lirePatient(patientId) : null;
    const masque = dossier ? masquer(dicte, dossier) : dicte;
    const nom = dossier ? libellePatient(dossier) : "";
    const actions = (await proposerActions(masque, jourLocal(new Date()), superieur === true)).map((a) =>
      // Le nom masqué reprend sa place dans ce que le médecin relit
      nom && "texte" in a ? { ...a, texte: a.texte.replaceAll("[PATIENT]", nom) } : a,
    );
    await journaliser(utilisateur.identifiant, "note vocale rangée par Claude", patientId, `${dicte.length} caractères`);
    return Response.json({ actions: actions.length ? actions : simple, parClaude: true });
  } catch (erreur) {
    console.error(erreur);
    return Response.json({
      actions: simple,
      parClaude: false,
      avertissement: "Claude n'a pas pu ranger la note : elle est proposée telle quelle.",
    });
  }
}

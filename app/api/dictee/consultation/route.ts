// Consultation écoutée : transcription du navigateur (médecin et patient) → note par rubriques, à relire par le médecin.
// L'accord du patient est obligatoire (et inscrit au journal) ; le son n'est jamais envoyé ni conservé, seul le texte
// transcrit part, avec le nom du patient masqué. Médecins seulement.

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { claudeConfigure, rapporterConsultation } from "../../../dossier/dictee";
import { journaliser } from "../../../dossier/journal";
import { lirePatient } from "../../../dossier/patients";
import { masquer } from "../../../dossier/reprise";

export const maxDuration = 120;

export async function POST(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return Response.json({ erreur: "Session expirée : reconnectez-vous." }, { status: 401 });
  if (!accesMedical(utilisateur)) return Response.json({ erreur: "Réservé aux médecins." }, { status: 403 });
  if (!claudeConfigure()) return Response.json({ erreur: "Claude n'est pas configuré (voir DOSSIER.md)." }, { status: 503 });

  const { texte, patient, accord, superieur } = (await request.json().catch(() => ({}))) as {
    texte?: unknown;
    patient?: unknown;
    accord?: unknown;
    superieur?: unknown;
  };
  if (accord !== true) return Response.json({ erreur: "L'accord du patient pour l'écoute de la consultation est requis." }, { status: 400 });
  if (typeof texte !== "string" || texte.trim().length < 20) return Response.json({ erreur: "Rien n'a été reconnu." }, { status: 400 });
  if (texte.length > 60_000) return Response.json({ erreur: "Enregistrement trop long (une heure environ au plus)." }, { status: 413 });
  const patientId = typeof patient === "number" && Number.isInteger(patient) && patient > 0 ? patient : null;
  try {
    const dossier = patientId ? await lirePatient(patientId) : null;
    const masque = dossier ? masquer(texte.trim(), dossier) : texte.trim();
    const note = await rapporterConsultation(masque, superieur === true);
    // Le nom masqué ne doit pas rester dans la note : « le patient »
    const rubriques = Object.fromEntries(Object.entries(note.rubriques).map(([r, t]) => [r, t.replaceAll("[PATIENT]", "le patient")]));
    await journaliser(utilisateur.identifiant, "consultation écoutée avec l'accord du patient", patientId, `${texte.length} caractères transcrits`);
    return Response.json({ ...note, rubriques });
  } catch (erreur) {
    console.error(erreur);
    return Response.json({ erreur: "Claude n'a pas pu rédiger la note. Réessayez, ou dictez la consultation." }, { status: 502 });
  }
}

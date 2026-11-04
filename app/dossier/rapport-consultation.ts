// Éléments rattachés à une consultation, mis en forme pour son rapport PDF : examens, calculs, ordonnances.
// La facture n'y figure pas : c'est un document de gestion, pas un document médical. Sans accès base : testé à part.

import type { Examen } from "./examens";
import type { Ordonnance } from "./ordonnances";
import type { ScorePatient } from "./scores-patients";

export type ElementsRapport = { calculs: string[]; examens: string[]; ordonnances: string[] };

const jour = (d: string) => d.split("-").reverse().join("/");
// Un texte long (compte rendu d'ETT) reste lisible dans le rapport : espaces réduits, 600 signes au plus
const resume = (texte: string) => {
  const t = texte.replace(/\s+/g, " ").trim();
  return t.length > 600 ? `${t.slice(0, 600).trimEnd()}…` : t;
};

export function elementsRapport(
  consultation: { id: number; date: string },
  liens: { scores: ScorePatient[]; examens: Examen[]; ordonnances: Ordonnance[] },
): ElementsRapport {
  const ici = <T extends { consultationId: number | null }>(liste: T[]) =>
    liste.filter((e) => e.consultationId === consultation.id);
  // La date n'est rappelée que si elle diffère de celle de la consultation
  const quand = (date: string) => (date === consultation.date ? "" : ` du ${jour(date)}`);

  const calculs = ici(liens.scores).map(
    (s) => `${s.titre}${quand(s.date)} : ${s.score !== null ? `score ${s.score}, ` : ""}${s.libelle}`,
  );
  const examens = ici(liens.examens).map(
    (e) => `${e.type}${quand(e.date)}${e.conclusion.trim() ? ` : ${resume(e.conclusion)}` : ""}`,
  );
  const prescriptions = ici(liens.ordonnances);
  const ordonnances = prescriptions.flatMap((o) => [
    ...(prescriptions.length > 1 || o.date !== consultation.date ? [`Ordonnance${quand(o.date)} :`] : []),
    ...o.lignes.map(
      (l) => `- ${l.medicament}${l.posologie ? ` — ${l.posologie}` : ""}${l.duree ? ` (${l.duree})` : ""}`,
    ),
    ...(o.remarque.trim() ? [`Remarque : ${resume(o.remarque)}`] : []),
  ]);
  return { calculs, examens, ordonnances };
}

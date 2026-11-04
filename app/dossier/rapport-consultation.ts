// Éléments rattachés à une consultation, mis en forme pour son rapport PDF : examens, calculs, ordonnances, facture.
// Sans accès base : testé à part.

import type { Facture } from "./compta";
import { libelleStatut, mad } from "./compta-calculs";
import type { Examen } from "./examens";
import type { Ordonnance } from "./ordonnances";
import type { ScorePatient } from "./scores-patients";

export type ElementsRapport = { calculs: string[]; examens: string[]; ordonnances: string[]; factures: string[] };

const jour = (d: string) => d.split("-").reverse().join("/");
// Un texte long (compte rendu d'ETT) reste lisible dans le rapport : espaces réduits, 600 signes au plus
const resume = (texte: string) => {
  const t = texte.replace(/\s+/g, " ").trim();
  return t.length > 600 ? `${t.slice(0, 600).trimEnd()}…` : t;
};

export function elementsRapport(
  consultation: { id: number; date: string },
  liens: { scores: ScorePatient[]; examens: Examen[]; ordonnances: Ordonnance[]; factures: Facture[] },
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
  // Une facture annulée n'a plus d'existence comptable : elle n'est pas rappelée
  const factures = ici(liens.factures)
    .filter((f) => !f.annulee)
    .map(
      (f) =>
        `Facture n° ${f.numero}${quand(f.date)} : ${mad(f.totalCts)}, ${libelleStatut[f.statut].toLowerCase()}` +
        (f.statut === "partielle" ? ` (reste ${mad(f.totalCts - f.payeCts)})` : ""),
    );
  return { calculs, examens, ordonnances, factures };
}

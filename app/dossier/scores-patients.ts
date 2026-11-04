// Calculateurs rattachés au dossier patient : le médecin choisit un calcul, enregistre le résultat à une date,
// et refait le calcul au fil du suivi pour voir l'évolution. Le score est recalculé ici, côté serveur,
// à partir des réponses : le navigateur ne fournit jamais le score lui-même.

import { base } from "./base";
import { calculateurs, trouverCalculateur } from "./calculateurs";
import { valeursNormalisees } from "./calculateurs/normalisation";
import type { Resultat, Valeurs } from "./calculateurs/types";

export type ScorePatient = {
  id: number;
  slug: string;
  titre: string;
  date: string; // "AAAA-MM-JJ"
  valeurs: Valeurs;
  score: number | null;
  libelle: string;
  gravite: Resultat["gravite"];
  creePar: string;
};

// Calcul complet à partir d'une saisie brute (ce qui vient du formulaire)
export function evaluerSaisie(slug: string, saisie: Record<string, unknown>) {
  const calculateur = trouverCalculateur(slug);
  if (!calculateur) return null;
  const valeurs = valeursNormalisees(calculateur, saisie);
  return { calculateur, valeurs, resultat: calculateur.evaluer(valeurs) };
}

export async function listerScoresPatient(patientId: number): Promise<ScorePatient[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT id, calculateur, to_char(date, 'YYYY-MM-DD') AS date, valeurs, score, libelle, gravite, cree_par
    FROM scores_patients WHERE patient_id = ${patientId}
    ORDER BY date DESC, id DESC`;
  return lignes.map((l) => ({
    id: l.id as number,
    slug: l.calculateur as string,
    titre: trouverCalculateur(l.calculateur as string)?.titre ?? (l.calculateur as string),
    date: l.date as string,
    valeurs: (l.valeurs as Valeurs) ?? {},
    score: l.score === null ? null : Number(l.score),
    libelle: l.libelle as string,
    gravite: l.gravite as Resultat["gravite"],
    creePar: l.cree_par as string,
  }));
}

export async function ajouterScorePatient(
  patientId: number,
  slug: string,
  date: string,
  saisie: Record<string, unknown>,
  par: string,
) {
  const calcul = evaluerSaisie(slug, saisie);
  if (!calcul) throw new Error(`Calculateur inconnu : ${slug}`);
  const sql = await base();
  const [ligne] = await sql`
    INSERT INTO scores_patients (patient_id, calculateur, date, valeurs, score, libelle, gravite, cree_par)
    VALUES (${patientId}, ${slug}, ${date}, ${JSON.stringify(calcul.valeurs)}::jsonb, ${calcul.resultat.score},
            ${calcul.resultat.libelle}, ${calcul.resultat.gravite}, ${par})
    RETURNING id`;
  return ligne.id as number;
}

export async function supprimerScorePatient(patientId: number, id: number) {
  const sql = await base();
  await sql`DELETE FROM scores_patients WHERE patient_id = ${patientId} AND id = ${id}`;
}

// Calculateurs proposés au médecin, dans l'ordre du catalogue
export const catalogueScores = calculateurs.map((c) => ({ slug: c.slug, titre: c.titre, resume: c.resume }));

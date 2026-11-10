// Vue d'ensemble de la patientèle : INR hors de la zone cible et patients perdus de vue. Réservé aux médecins.
// Ce sont des repères à vérifier dans le dossier, pas des décisions.

import { base } from "./base";

export type InrHorsCible = { patientId: number; nom: string; prenom: string; date: string; inr: number; min: number; max: number };
export type PerduDeVue = { patientId: number; nom: string; prenom: string; telephone: string; derniere: string; traitements: number };

// Dernier INR de chaque patient qui a une zone cible, quand il en sort. Un INR de plus de 6 mois est signalé à part.
export async function inrHorsCible(): Promise<InrHorsCible[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT DISTINCT ON (c.patient_id) c.patient_id, p.nom, p.prenom, c.date, (c.mesures->>'inr')::numeric AS inr,
      p.inr_min, p.inr_max
    FROM consultations c JOIN patients p ON p.id = c.patient_id
    WHERE p.inr_min IS NOT NULL AND p.inr_max IS NOT NULL AND c.mesures ? 'inr'
    ORDER BY c.patient_id, c.date DESC, c.id DESC`;
  return lignes
    .map((l) => ({
      patientId: l.patient_id as number,
      nom: l.nom as string,
      prenom: l.prenom as string,
      date: l.date as string,
      inr: Number(l.inr),
      min: Number(l.inr_min),
      max: Number(l.inr_max),
    }))
    .filter((x) => x.inr < x.min || x.inr > x.max)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Patients avec un traitement en cours dont la dernière consultation date de plus de `mois` mois (ou n'existe pas)
export async function perdusDeVue(aujourdhui: string, mois = 12): Promise<PerduDeVue[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT p.id, p.nom, p.prenom, p.telephone, max(c.date) AS derniere,
      (SELECT count(*) FROM traitements t WHERE t.patient_id = p.id AND t.fin IS NULL)::int AS traitements
    FROM patients p LEFT JOIN consultations c ON c.patient_id = p.id
    GROUP BY p.id
    HAVING (SELECT count(*) FROM traitements t WHERE t.patient_id = p.id AND t.fin IS NULL) > 0
      AND (max(c.date) IS NULL OR max(c.date) < (${aujourdhui}::date - make_interval(months => ${mois})))
    ORDER BY max(c.date) NULLS FIRST, p.nom LIMIT 200`;
  return lignes.map((l) => ({
    patientId: l.id as number,
    nom: l.nom as string,
    prenom: l.prenom as string,
    telephone: l.telephone as string,
    derniere: (l.derniere as string | null) ?? "",
    traitements: l.traitements as number,
  }));
}

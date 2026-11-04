// Journal des accès aux dossiers : qui a consulté ou modifié quoi, et quand. Consultable par l'administrateur.

import { base } from "./base";

export type Entree = { quand: Date; qui: string; action: string; patientId: number | null; detail: string };

export async function journaliser(qui: string, action: string, patientId: number | null, detail = "") {
  const sql = await base();
  await sql`INSERT INTO journal (qui, action, patient_id, detail) VALUES (${qui}, ${action}, ${patientId}, ${detail})`;
}

export type Niveau = "critique" | "eleve" | "modere" | "faible";
export const NIVEAUX: { id: Niveau; libelle: string; classe: string }[] = [
  { id: "critique", libelle: "Critique", classe: "bg-red-100 text-red-800 ring-red-200" },
  { id: "eleve", libelle: "Élevé", classe: "bg-orange-100 text-orange-800 ring-orange-200" },
  { id: "modere", libelle: "Modéré", classe: "bg-amber-100 text-amber-800 ring-amber-200" },
  { id: "faible", libelle: "Faible", classe: "bg-slate-100 text-slate-600 ring-slate-200" },
];

// Niveau de criticité déduit du libellé de l'action (première règle qui correspond).
const REGLES: [RegExp, Niveau][] = [
  [/supprim|annulée|mot de passe|déconnecté|export comptable|mode de partage|accès abonné modifié/, "critique"],
  [/bibliothèque|seuil|réponse|fiche validée|calcul/, "faible"],
  [/^création$|^modification$|modifiée|rendez-vous modifié|ajouté|enregistré|rédigé|paiement|facture créée|arrêté|retiré|ignoré|confirmé|classé|connecté/, "eleve"],
  [/imprim|ouvert|suivi/, "modere"],
];

export function niveauAction(action: string): Niveau {
  for (const [regle, niveau] of REGLES) if (regle.test(action)) return niveau;
  return "faible";
}

export type Filtres = {
  patientId: number | null;
  qui: string;
  texte: string;
  du: string;
  au: string;
  niveau: Niveau | null;
};

export async function utilisateursJournal(): Promise<string[]> {
  const sql = await base();
  const lignes = await sql`SELECT DISTINCT qui FROM journal ORDER BY qui`;
  return lignes.map((l) => l.qui as string);
}

// Filtres appliqués côté base (sauf le niveau, déduit en code), puis `limite` entrées les plus récentes.
export async function lireJournal(f: Filtres, fuseau: string, limite = 200): Promise<Entree[]> {
  const sql = await base();
  const texte = `%${f.texte.replace(/[\\%_]/g, "\\$&")}%`;
  const lignes = await sql`
    SELECT quand, qui, action, patient_id, detail FROM journal
    WHERE (${f.patientId === null} OR patient_id = ${f.patientId})
      AND (${f.qui === ""} OR qui = ${f.qui})
      AND (${f.texte === ""} OR action ILIKE ${texte} OR detail ILIKE ${texte})
      AND (${f.du === ""} OR quand >= (${f.du || "1970-01-01"}::date)::timestamp AT TIME ZONE ${fuseau})
      AND (${f.au === ""} OR quand < ((${f.au || "1970-01-01"}::date + 1)::timestamp AT TIME ZONE ${fuseau}))
    ORDER BY quand DESC LIMIT ${f.niveau ? 5000 : limite}`;
  const entrees = lignes.map((l) => ({
    quand: l.quand as Date,
    qui: l.qui as string,
    action: l.action as string,
    patientId: l.patient_id as number | null,
    detail: l.detail as string,
  }));
  return (f.niveau ? entrees.filter((e) => niveauAction(e.action) === f.niveau) : entrees).slice(0, limite);
}

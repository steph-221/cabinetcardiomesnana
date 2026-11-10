// Journal des appels à Claude : jetons et coût estimé par tâche, pour suivre la dépense et voir quelles tâches
// échouent sur leur modèle économique. Aucune donnée de patient n'y figure.

import { base, baseConfiguree } from "../base";
import { ecrireParametre, lireParametre } from "../parametres";
import { lireReglageEnregistre, taches, type Jetons, type Niveau, type Reglage, type Tache } from "./taches";

export type Issue = "ok" | "refus" | "tronque" | "controle" | "erreur";

export type Appel = Jetons & {
  tache: Tache;
  // Modèle qui a réellement répondu (peut différer du modèle demandé après un repli de l'API)
  modele: string;
  niveau: Niveau;
  effort: string;
  cout: number;
  dureeMs: number;
  escalade: boolean;
  issue: Issue;
  par: string;
};

// Ne doit jamais faire échouer l'appel qu'il décrit
export async function noterAppel(a: Appel) {
  if (!baseConfiguree()) return;
  try {
    const sql = await base();
    await sql`
      INSERT INTO ia_usage (tache, modele, niveau, effort, entree, sortie, cache_lecture, cache_ecriture, cout,
                            duree_ms, escalade, issue, par)
      VALUES (${a.tache}, ${a.modele}, ${a.niveau}, ${a.effort}, ${a.entree}, ${a.sortie}, ${a.cacheLecture},
              ${a.cacheEcriture}, ${a.cout}, ${a.dureeMs}, ${a.escalade}, ${a.issue}, ${a.par})`;
  } catch (erreur) {
    console.error(erreur);
  }
}

const cle = (tache: Tache) => `ia:${tache}`;

export async function lireReglage(tache: Tache): Promise<Reglage> {
  let brut: string | null = null;
  if (baseConfiguree()) {
    try {
      brut = await lireParametre(cle(tache));
    } catch (erreur) {
      console.error(erreur);
    }
  }
  return lireReglageEnregistre(tache, brut);
}

export async function lireReglages(): Promise<Record<Tache, Reglage>> {
  const sql = await base();
  const lignes = await sql`SELECT cle, valeur FROM parametres WHERE cle LIKE 'ia:%'`;
  const enregistres = new Map(lignes.map((l) => [l.cle as string, l.valeur as string]));
  return Object.fromEntries(
    (Object.keys(taches) as Tache[]).map((t) => [t, lireReglageEnregistre(t, enregistres.get(cle(t)) ?? null)]),
  ) as Record<Tache, Reglage>;
}

// null : retour au réglage de départ
export async function ecrireReglage(tache: Tache, reglage: Reglage | null) {
  await ecrireParametre(cle(tache), reglage ? JSON.stringify(reglage) : null);
}

export type LigneUsage = {
  mois: string; // "AAAA-MM"
  tache: string;
  niveau: string;
  appels: number;
  entree: number;
  sortie: number;
  cout: number;
  escalades: number;
  echecs: number;
};

// Dépense des derniers mois, par mois, tâche et modèle
export async function resumeUsage(fuseau: string, mois = 3): Promise<LigneUsage[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT to_char(quand AT TIME ZONE ${fuseau}, 'YYYY-MM') AS mois, tache, niveau,
      count(*)::int AS appels, sum(entree + cache_lecture + cache_ecriture)::int AS entree, sum(sortie)::int AS sortie,
      sum(cout)::float8 AS cout, count(*) FILTER (WHERE escalade)::int AS escalades,
      count(*) FILTER (WHERE issue <> 'ok')::int AS echecs
    FROM ia_usage
    WHERE quand >= date_trunc('month', now() AT TIME ZONE ${fuseau}) - make_interval(months => ${mois - 1})
    GROUP BY 1, 2, 3
    ORDER BY 1 DESC, 2, 3`;
  return lignes as LigneUsage[];
}

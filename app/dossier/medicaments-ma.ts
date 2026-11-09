// Base publique des médicaments du Maroc (medicament.ma) : recherche pour l'ordonnance et la bibliothèque.
// La copie vit en base (voir veille-medicaments.ts) ; sans base, le fichier livré avec l'application
// (medicaments-ma.json, relevé par scripts/import-medicament-ma.mjs) sert de repli.

import { baseConfiguree } from "./base";
import { famillesDe, normaliser, situations } from "./cardio-medicaments";

export type MedicamentMa = {
  nom: string; // « BISOPROLOL 5 MG, Comprimé pelliculé »
  url: string; // fiche publique sur medicament.ma
  generique: boolean;
  presentation: string;
  dosage: string;
  labo: string;
  dci: string; // composition (substances actives)
  classe: string; // classe thérapeutique
  statut: string; // Commercialisé, etc.
  ppv: string; // prix public de vente
  tableau: string;
};

export type Resultat = MedicamentMa & { familles: string[]; prix: number | null; forme: string };

export type Criteres = {
  q?: string;
  famille?: string;
  situation?: string;
  forme?: string;
  type?: "generique" | "princeps" | "";
  labo?: string;
  prixMax?: number | null;
  commercialises?: boolean; // défaut : oui
  tri?: "pertinence" | "prix" | "nom";
};

// Formes regroupées pour le filtre (la forme exacte est dans le nom, après la virgule)
export const formes = ["comprimé", "gélule", "injectable", "sachet / poudre", "buvable", "patch / autre voie", "autre"] as const;

export function formeDe(nom: string): string {
  const t = normaliser(nom.split(",").slice(1).join(","));
  if (/comprime|cp\b|lyoc/.test(t)) return "comprimé";
  if (/gelule|capsule/.test(t)) return "gélule";
  if (/injectable|perfusion|seringue|ampoule/.test(t)) return "injectable";
  if (/sachet|poudre|granule/.test(t)) return "sachet / poudre";
  if (/buvable|sirop|solution orale|goutte/.test(t)) return "buvable";
  if (/patch|timbre|transdermique|spray|aerosol|collyre|creme|pommade|gel\b|suppositoire/.test(t)) return "patch / autre voie";
  return "autre";
}

export const prixDe = (ppv: string) => {
  const n = parseFloat(ppv.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const enrichis = new WeakMap<MedicamentMa, Resultat>();
const enrichir = (m: MedicamentMa): Resultat => {
  let r = enrichis.get(m);
  if (!r) {
    r = { ...m, familles: famillesDe(m.dci), prix: prixDe(m.ppv), forme: formeDe(m.nom) };
    enrichis.set(m, r);
  }
  return r;
};

// --- Source des données (cache de quelques minutes) ---------------------------------------------------------

type Index = { liste: Resultat[]; cles: string[] };
let index: { quand: number; valeur: Promise<Index> } | null = null;

async function charger(): Promise<Index> {
  let brut: MedicamentMa[] | null = null;
  if (baseConfiguree()) {
    try {
      const { listerMedicaments } = await import("./veille-medicaments");
      brut = await listerMedicaments();
    } catch (erreur) {
      console.error(erreur);
    }
  }
  brut ??= (await import("./medicaments-ma.json")).default as MedicamentMa[];
  const liste = brut.map(enrichir);
  return { liste, cles: liste.map((m) => normaliser(`${m.nom} ${m.dci} ${m.labo}`)) };
}

export function medicaments(): Promise<Index> {
  if (!index || Date.now() - index.quand > 5 * 60_000) index = { quand: Date.now(), valeur: charger() };
  return index.valeur;
}

// Après une vérification, la copie en mémoire est périmée
export const oublierCopie = () => {
  index = null;
};

// --- Recherche ---------------------------------------------------------------------------------------------------

const motsDe = (s: string) => normaliser(s).split(/[\s,]+/).filter(Boolean).slice(0, 6);

// Tous les mots saisis doivent apparaître ; un nom qui commence par la saisie passe en tête
export function filtrer(index: Index, c: Criteres, limite = 60): { resultats: Resultat[]; total: number } {
  const mots = motsDe(c.q ?? "");
  const debut = normaliser(c.q ?? "").trim();
  const famillesVoulues = new Set<string>(
    c.famille ? [c.famille] : c.situation ? (situations.find((s) => s.cle === c.situation)?.familles ?? []) : [],
  );
  const labo = c.labo ? normaliser(c.labo) : "";
  const trouves: { m: Resultat; rang: number }[] = [];
  for (const [i, m] of index.liste.entries()) {
    if (c.commercialises !== false && m.statut && !/commerc/i.test(m.statut)) continue;
    if (mots.length && !mots.every((mot) => index.cles[i].includes(mot))) continue;
    if (famillesVoulues.size && !m.familles.some((f) => famillesVoulues.has(f))) continue;
    if (c.forme && m.forme !== c.forme) continue;
    if (c.type === "generique" && !m.generique) continue;
    if (c.type === "princeps" && m.generique) continue;
    if (labo && !normaliser(m.labo).includes(labo)) continue;
    if (c.prixMax != null && (m.prix === null || m.prix > c.prixMax)) continue;
    const nom = normaliser(m.nom);
    const rang = !debut ? 3 : nom.startsWith(debut) ? 0 : nom.startsWith(mots[0] ?? "") ? 1 : normaliser(m.dci).startsWith(mots[0] ?? "") ? 2 : 3;
    trouves.push({ m, rang: rang + (m.statut && !/commerc/i.test(m.statut) ? 0.5 : 0) });
  }
  if (c.tri === "prix") trouves.sort((a, b) => (a.m.prix ?? Infinity) - (b.m.prix ?? Infinity));
  else if (c.tri === "nom") trouves.sort((a, b) => a.m.nom.localeCompare(b.m.nom, "fr"));
  else trouves.sort((a, b) => a.rang - b.rang);
  return { resultats: trouves.slice(0, limite).map((t) => t.m), total: trouves.length };
}

export async function rechercherMedicaments(c: Criteres, limite = 60) {
  return filtrer(await medicaments(), c, limite);
}

// Compatibilité : suggestions de l'ordonnance (saisie libre, peu de résultats)
export async function chercherMedicaments(saisie: string, limite = 8): Promise<MedicamentMa[]> {
  if (normaliser(saisie).trim().length < 2) return [];
  return (await rechercherMedicaments({ q: saisie }, limite)).resultats;
}

// Laboratoires les plus fournis en médicaments cardiovasculaires, pour le filtre
export async function laboratoires(): Promise<string[]> {
  const { liste } = await medicaments();
  const n = new Map<string, number>();
  for (const m of liste) if (m.familles.length && m.labo) n.set(m.labo, (n.get(m.labo) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l).slice(0, 60);
}

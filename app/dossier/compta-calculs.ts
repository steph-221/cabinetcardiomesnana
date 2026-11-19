// Comptabilité du cabinet — calculs purs (aucun accès à la base : utilisable partout, testable).
// Tous les montants sont en CENTIMES (entiers) pour éviter les erreurs d'arrondi : 300 MAD = 30000.

export const modesPaiement = [
  { valeur: "especes", libelle: "Espèces" },
  { valeur: "cheque", libelle: "Chèque" },
  { valeur: "carte", libelle: "Carte bancaire" },
  { valeur: "virement", libelle: "Virement" },
  { valeur: "mutuelle", libelle: "Mutuelle / assurance" },
] as const;
export type ModePaiement = (typeof modesPaiement)[number]["valeur"];
export const estMode = (v: string): v is ModePaiement => modesPaiement.some((m) => m.valeur === v);
export const libelleMode = (v: string) => modesPaiement.find((m) => m.valeur === v)?.libelle ?? v;

export const categoriesCharges = [
  "Loyer et charges locatives",
  "Électricité, eau",
  "Téléphone, internet",
  "Salaires",
  "Charges sociales (CNSS…)",
  "Fournitures médicales",
  "Matériel et petit équipement",
  "Maintenance des appareils",
  "Assurances (RC professionnelle…)",
  "Honoraires du comptable",
  "Impôts et taxes",
  "Cotisations (Ordre, société savante)",
  "Formation, congrès",
  "Déplacements",
  "Frais bancaires",
  "Autre",
] as const;

export type LigneFacture = { libelle: string; quantite: number; prixCts: number };

export type StatutFacture = "annulee" | "payee" | "partielle" | "impayee";
export const libelleStatut: Record<StatutFacture, string> = {
  annulee: "Annulée",
  payee: "Payée",
  partielle: "Partiellement payée",
  impayee: "Impayée",
};

// --- Montants ---

// « 300 », « 300,5 », « 1 200.50 » → centimes ; null si ce n'est pas un montant valide (positif ou nul)
export function lireMontant(saisie: string): number | null {
  const propre = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(propre)) return null;
  return Math.round(Number(propre) * 100);
}

// 30050 → « 300,50 » ; 30000 → « 300 » avec `court`
export function montant(cts: number, court = false) {
  const entier = court && cts % 100 === 0;
  return (cts / 100)
    .toLocaleString("fr-FR", { minimumFractionDigits: entier ? 0 : 2, maximumFractionDigits: 2 })
    .replace(/[  ]/g, " ");
}
export const mad = (cts: number, court = false) => `${montant(cts, court)} MAD`;

// Valeur à remettre dans un champ de formulaire : 30050 → « 300,50 » (sans séparateur de milliers)
export const pourChamp = (cts: number) => (cts % 100 === 0 ? String(cts / 100) : (cts / 100).toFixed(2).replace(".", ","));

export const totalLignes = (lignes: LigneFacture[]) =>
  lignes.reduce((somme, l) => somme + Math.round(l.quantite * l.prixCts), 0);

export const totalFacture = (lignes: LigneFacture[], remiseCts: number) =>
  Math.max(0, totalLignes(lignes) - remiseCts);

export function statutFacture(f: { annulee: boolean; totalCts: number; payeCts: number }): StatutFacture {
  if (f.annulee) return "annulee";
  if (f.payeCts >= f.totalCts) return "payee";
  return f.payeCts > 0 ? "partielle" : "impayee";
}

// Partage un montant en parts proportionnelles ; la somme des parts est toujours exactement le montant
// (les centimes restants vont aux plus gros restes).
export function partager(montantCts: number, poids: number[]): number[] {
  const total = poids.reduce((a, b) => a + b, 0);
  if (poids.length === 0) return [];
  if (total <= 0) return poids.map((_, i) => (i === 0 ? montantCts : 0));
  const exact = poids.map((p) => (montantCts * p) / total);
  const parts = exact.map(Math.floor);
  let reste = montantCts - parts.reduce((a, b) => a + b, 0);
  const ordre = exact.map((e, i) => ({ i, reste: e - Math.floor(e) })).sort((a, b) => b.reste - a.reste);
  for (const { i } of ordre) {
    if (reste <= 0) break;
    parts[i] += 1;
    reste -= 1;
  }
  return parts;
}

// --- Répartition entre les médecins ---

export type PartMedecin = { id: number; nom: string; part: number };
export type LigneRepartition = {
  id: number;
  nom: string;
  part: number; // pourcentage des charges communes (ou du résultat mis en commun)
  encaisse: number; // honoraires réellement encaissés pour ses actes
  recettes: number; // recettes qui lui reviennent (= encaisse, ou sa part du pot commun si mis en commun)
  chargesCommunes: number; // sa quote-part des charges communes
  chargesPerso: number; // charges qui lui sont propres
  resultat: number;
};

export function repartir(
  medecins: PartMedecin[],
  encaisseParMedecin: Map<number, number>,
  chargesCommunes: number,
  chargesPersoParMedecin: Map<number, number>,
  miseEnCommun: boolean,
): LigneRepartition[] {
  const poids = medecins.map((m) => m.part);
  const quotes = partager(chargesCommunes, poids);
  const encaisses = medecins.map((m) => encaisseParMedecin.get(m.id) ?? 0);
  const pot = miseEnCommun ? partager(encaisses.reduce((a, b) => a + b, 0), poids) : encaisses;
  return medecins.map((m, i) => {
    const chargesPerso = chargesPersoParMedecin.get(m.id) ?? 0;
    return {
      id: m.id,
      nom: m.nom,
      part: m.part,
      encaisse: encaisses[i],
      recettes: pot[i],
      chargesCommunes: quotes[i],
      chargesPerso,
      resultat: pot[i] - quotes[i] - chargesPerso,
    };
  });
}

// --- Périodes : « 2026-11 » (un mois) ou « 2026 » (une année) ---

export const periodeValide = (p: string) => /^\d{4}(-(0[1-9]|1[0-2]))?$/.test(p);

export function bornes(periode: string): { du: string; au: string } {
  if (periode.length === 4) return { du: `${periode}-01-01`, au: `${periode}-12-31` };
  const [a, m] = periode.split("-").map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { du: `${periode}-01`, au: `${periode}-${String(dernier).padStart(2, "0")}` };
}

export function periodeVoisine(periode: string, sens: 1 | -1): string {
  if (periode.length === 4) return String(Number(periode) + sens);
  const [a, m] = periode.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + sens, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const nomMois = (m: number) => MOIS[m - 1];
export function titrePeriode(periode: string) {
  if (periode.length === 4) return `Année ${periode}`;
  const [a, m] = periode.split("-").map(Number);
  return `${nomMois(m)} ${a}`;
}

// --- Montant en lettres (mention des factures : « arrêtée à la somme de… ») ---

const UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function sousMille(n: number, finDeNombre: boolean): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  let texte = "";
  if (c > 0) {
    texte = c === 1 ? "cent" : `${UNITES[c]} cent`;
    if (c > 1 && reste === 0 && finDeNombre) texte += "s";
  }
  if (reste === 0) return texte;
  let r: string;
  if (reste < 20) r = UNITES[reste];
  else {
    const d = Math.floor(reste / 10);
    const u = reste % 10;
    if (d === 7 || d === 9) {
      const sous = 10 + u;
      r = `${DIZAINES[d]}${d === 7 && u === 1 ? " et " : "-"}${UNITES[sous]}`;
    } else if (u === 0) r = d === 8 && finDeNombre ? "quatre-vingts" : DIZAINES[d];
    else r = `${DIZAINES[d]}${u === 1 && d !== 8 ? " et " : "-"}${UNITES[u]}`;
  }
  return texte ? `${texte} ${r}` : r;
}

export function enLettres(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999_999) return String(n);
  if (n === 0) return "zéro";
  const millions = Math.floor(n / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;
  const morceaux: string[] = [];
  if (millions) morceaux.push(`${sousMille(millions, false)} million${millions > 1 ? "s" : ""}`);
  if (milliers) morceaux.push(milliers === 1 ? "mille" : `${sousMille(milliers, false)} mille`);
  if (reste) morceaux.push(sousMille(reste, true));
  return morceaux.join(" ");
}

// 123456 → « mille deux cent trente-quatre dirhams et cinquante-six centimes »
export function montantEnLettres(cts: number) {
  const dirhams = Math.floor(cts / 100);
  const centimes = cts % 100;
  const d = `${enLettres(dirhams)} dirham${dirhams > 1 ? "s" : ""}`;
  return centimes ? `${d} et ${enLettres(centimes)} centime${centimes > 1 ? "s" : ""}` : d;
}

// Statistiques de la comptabilité : périodes, regroupement (jour / semaine / mois), échelles des graphiques.
// Fonctions pures, sans base de données : elles se testent à part (compta-stats-calculs.test.ts).
// Les dates sont des chaînes « AAAA-MM-JJ », comme partout dans la comptabilité.

export type Granularite = "jour" | "semaine" | "mois";
export const granularites: { valeur: Granularite; libelle: string }[] = [
  { valeur: "jour", libelle: "Par jour" },
  { valeur: "semaine", libelle: "Par semaine" },
  { valeur: "mois", libelle: "Par mois" },
];
export const estGranularite = (v: string): v is Granularite => granularites.some((g) => g.valeur === v);

// --- Dates ---

const MS_JOUR = 86_400_000;
const enMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const enDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function estDate(valeur: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;
  return enDate(enMs(valeur)) === valeur; // refuse le 31 juin, le 30 février…
}

export const ajouterJours = (d: string, n: number) => enDate(enMs(d) + n * MS_JOUR);
export const ecartJours = (a: string, b: string) => Math.round((enMs(b) - enMs(a)) / MS_JOUR);

export function ajouterMois(d: string, n: number): string {
  const total = Number(d.slice(0, 4)) * 12 + (Number(d.slice(5, 7)) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

const debutMois = (d: string) => `${d.slice(0, 7)}-01`;
const finMois = (d: string) => ajouterJours(ajouterMois(d, 1), -1);

// Lundi de la semaine de `d` (semaine ISO, comme date_trunc('week') de Postgres)
export function lundi(d: string): string {
  const jourSemaine = new Date(enMs(d)).getUTCDay(); // 0 = dimanche
  return ajouterJours(d, -((jourSemaine + 6) % 7));
}

// --- Périodes : raccourcis et dates libres ---

export const raccourcis = [
  { id: "mois", libelle: "Ce mois" },
  { id: "mois-dernier", libelle: "Mois dernier" },
  { id: "3mois", libelle: "3 derniers mois" },
  { id: "12mois", libelle: "12 derniers mois" },
  { id: "annee", libelle: "Cette année" },
  { id: "annee-derniere", libelle: "Année dernière" },
  { id: "tout", libelle: "Tout" },
] as const;
export type Raccourci = (typeof raccourcis)[number]["id"];
export const estRaccourci = (v: string): v is Raccourci => raccourcis.some((r) => r.id === v);

export const RACCOURCI_PAR_DEFAUT: Raccourci = "annee";
const DUREE_MAX_JOURS = 3660; // 10 ans : au-delà, le début est ramené en arrière

// `du` vaut null pour « Tout » : la requête le remplace par la date de la première facture.
export type Periode = { du: string | null; au: string; raccourci: Raccourci | null };

export function periodeDuRaccourci(id: Raccourci, aujourdhui: string): Periode {
  const moisCourant = debutMois(aujourdhui);
  switch (id) {
    case "mois":
      return { du: moisCourant, au: aujourdhui, raccourci: id };
    case "mois-dernier": {
      const debut = ajouterMois(moisCourant, -1);
      return { du: debut, au: finMois(debut), raccourci: id };
    }
    case "3mois":
      return { du: ajouterMois(moisCourant, -2), au: aujourdhui, raccourci: id };
    case "12mois":
      return { du: ajouterMois(moisCourant, -11), au: aujourdhui, raccourci: id };
    case "annee":
      return { du: `${aujourdhui.slice(0, 4)}-01-01`, au: aujourdhui, raccourci: id };
    case "annee-derniere": {
      const a = Number(aujourdhui.slice(0, 4)) - 1;
      return { du: `${a}-01-01`, au: `${a}-12-31`, raccourci: id };
    }
    case "tout":
      return { du: null, au: aujourdhui, raccourci: id };
  }
}

// Lit les paramètres de l'adresse (?p=… ou ?du=…&au=…). Tout ce qui est invalide retombe sur le raccourci par défaut.
export function lirePeriode(params: { p?: string; du?: string; au?: string }, aujourdhui: string): Periode {
  const { p, du, au } = params;
  if (du && au && estDate(du) && estDate(au)) {
    const [debut, fin] = du <= au ? [du, au] : [au, du];
    const plancher = ajouterJours(fin, -DUREE_MAX_JOURS);
    return { du: debut < plancher ? plancher : debut, au: fin, raccourci: null };
  }
  return periodeDuRaccourci(p && estRaccourci(p) ? p : RACCOURCI_PAR_DEFAUT, aujourdhui);
}

// Période de même durée, juste avant celle-ci (pour « par rapport à la période précédente »)
export function periodePrecedente(du: string, au: string): { du: string; au: string } {
  const duree = ecartJours(du, au) + 1;
  const fin = ajouterJours(du, -1);
  return { du: ajouterJours(fin, -(duree - 1)), au: fin };
}

// --- Regroupement ---

// « Jour » seulement jusqu'à ~3 mois, « semaine » jusqu'à ~13 mois : au-delà les barres deviendraient illisibles.
const MAX_JOURS_PAR_JOUR = 92;
const MAX_JOURS_PAR_SEMAINE = 400;

export function granulariteEffective(demandee: Granularite | null, du: string, au: string): Granularite {
  const jours = ecartJours(du, au) + 1;
  const automatique: Granularite = jours <= 45 ? "jour" : jours <= 120 ? "semaine" : "mois";
  const choix = demandee ?? automatique;
  if (choix === "jour" && jours > MAX_JOURS_PAR_JOUR) return jours > MAX_JOURS_PAR_SEMAINE ? "mois" : "semaine";
  if (choix === "semaine" && jours > MAX_JOURS_PAR_SEMAINE) return "mois";
  return choix;
}

const MOIS_COURTS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const JOURS_SEMAINE_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const jourMois = (d: string) => Number(d.slice(8, 10));
const numMois = (d: string) => Number(d.slice(5, 7));
// 4 novembre 2026 (et « 1er » le premier du mois)
export const dateLongue = (d: string) => `${jourMois(d) === 1 ? "1er" : jourMois(d)} ${MOIS_LONGS[numMois(d) - 1]} ${d.slice(0, 4)}`;

// Un seau = une barre du graphique : un jour, une semaine (du lundi au dimanche) ou un mois
export type Seau = {
  cle: string; // premier jour du seau (c'est aussi la clé renvoyée par la base)
  court: string; // sous la barre
  long: string; // dans l'infobulle et le tableau
  annee: string | null; // affichée sous le premier seau et à chaque changement d'année
};

export function cleSeau(date: string, g: Granularite): string {
  if (g === "jour") return date;
  if (g === "semaine") return lundi(date);
  return debutMois(date);
}

export function seaux(du: string, au: string, g: Granularite): Seau[] {
  const resultat: Seau[] = [];
  const suivant = (cle: string) => (g === "jour" ? ajouterJours(cle, 1) : g === "semaine" ? ajouterJours(cle, 7) : ajouterMois(cle, 1));
  for (let cle = cleSeau(du, g); cle <= au; cle = suivant(cle)) {
    const precedent = resultat.at(-1);
    const changeAnnee = !precedent || precedent.cle.slice(0, 4) !== cle.slice(0, 4);
    const court =
      g === "mois" ? MOIS_COURTS[numMois(cle) - 1] : `${jourMois(cle)} ${MOIS_COURTS[numMois(cle) - 1]}`;
    const long =
      g === "mois"
        ? `${MOIS_LONGS[numMois(cle) - 1]} ${cle.slice(0, 4)}`
        : g === "semaine"
          ? `Semaine du ${dateLongue(cle)}`
          : `${JOURS_LONGS[new Date(enMs(cle)).getUTCDay()]} ${dateLongue(cle)}`;
    resultat.push({ cle, court, long, annee: changeAnnee ? cle.slice(0, 4) : null });
  }
  return resultat;
}

// Une barre par jour de la semaine (1 = lundi … 7 = dimanche), pour la fréquentation
export const seauxJoursSemaine: Seau[] = JOURS_SEMAINE_COURTS.map((court, i) => ({
  cle: String(i + 1),
  court,
  long: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][i],
  annee: null,
}));

// --- Tableaux de valeurs ---

// Remplit une matrice [seau][série] à partir des lignes renvoyées par la base ; les trous valent 0.
export function matrice(
  liste: Seau[],
  series: string[],
  lignes: { cle: string; serie: string; valeur: number }[],
): number[][] {
  const ligne = new Map(liste.map((s, i) => [s.cle, i]));
  const colonne = new Map(series.map((s, i) => [s, i]));
  const m = liste.map(() => series.map(() => 0));
  for (const l of lignes) {
    const i = ligne.get(l.cle);
    const j = colonne.get(l.serie);
    if (i !== undefined && j !== undefined) m[i][j] += l.valeur;
  }
  return m;
}

export const somme = (valeurs: number[]) => valeurs.reduce((s, v) => s + v, 0);

// --- Comparaison avec la période précédente ---

export type Variation = { pourcent: number; sens: "hausse" | "baisse" | "stable" };

// Pas de variation à donner quand il n'y avait rien avant (division par zéro, ou période sans historique)
export function variation(actuel: number, precedent: number): Variation | null {
  if (!(precedent > 0)) return null;
  const pourcent = Math.round(((actuel - precedent) / precedent) * 100);
  return { pourcent, sens: pourcent > 0 ? "hausse" : pourcent < 0 ? "baisse" : "stable" };
}

// --- Échelle de l'axe : des repères ronds (0 / 1 000 / 2 000) ---

export function echelle(maximum: number, reperes = 4): { haut: number; reperes: number[] } {
  if (!(maximum > 0)) return { haut: 1, reperes: [0, 1] };
  const brut = maximum / reperes;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((k) => k * puissance).find((p) => p >= brut) ?? 10 * puissance;
  const haut = Math.ceil(maximum / pas) * pas;
  const liste: number[] = [];
  for (let v = 0; v <= haut + pas / 2; v += pas) liste.push(Math.round(v * 100) / 100);
  return { haut, reperes: liste };
}

// 0 / 1 000 / 2 000, puis 10 k / 20 k quand l'axe monte haut : un seul style par axe
export function repereCourt(valeur: number, enMilliers: boolean): string {
  const nombre = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
  return enMilliers && valeur !== 0 ? `${nombre(valeur / 1000)} k` : nombre(valeur);
}

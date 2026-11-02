// Calculateurs cliniques décrits par des données : un schéma commun, un évaluateur pur, une interface générique.
// Aucun accès à la base ici, pour pouvoir s'en servir aussi dans le navigateur.

export type Option = { valeur: string; libelle: string; points?: number };

export type Champ =
  | { type: "case"; cle: string; libelle: string; groupe?: string; points?: number; aide?: string }
  | { type: "choix"; cle: string; libelle: string; groupe?: string; options: Option[]; aide?: string }
  | { type: "nombre"; cle: string; libelle: string; groupe?: string; unite?: string; aide?: string };

// Valeurs saisies : booléen pour une case, valeur de l'option retenue pour un choix
// (nombre saisi pour un champ numérique, undefined tant qu'il est vide)
export type Valeurs = Record<string, boolean | string | number | undefined>;

export type Resultat = {
  score: number | null;
  libelle: string; // niveau de risque ou conclusion
  gravite: "faible" | "moyen" | "eleve" | "tres-eleve" | "neutre";
  recommandation?: string;
};

export type Calculateur = {
  slug: string;
  titre: string;
  resume: string;
  specialite: "cardiologie" | "cardio-oncologie" | "urgences" | "biologie";
  champs: Champ[];
  evaluer: (valeurs: Valeurs) => Resultat;
  notes?: string[]; // limites d'emploi, à afficher sous le résultat
  source: { libelle: string; url?: string };
  // Origine des seuils, pour savoir ce qui a été vérifié
  verification: string;
};

// Points d'un champ pour les valeurs données
export function pointsChamp(champ: Champ, valeurs: Valeurs): number {
  const v = valeurs[champ.cle];
  if (champ.type === "nombre") return 0;
  if (champ.type === "case") return v === true ? (champ.points ?? 0) : 0;
  return champ.options.find((o) => o.valeur === v)?.points ?? 0;
}

export function totalPoints(champs: Champ[], valeurs: Valeurs): number {
  return champs.reduce((somme, c) => somme + pointsChamp(c, valeurs), 0);
}

export type Palier = { min: number; libelle: string; gravite: Resultat["gravite"]; recommandation?: string };

// Score à points : le palier retenu est le premier dont le minimum est atteint (paliers du plus haut au plus bas)
export function calculateurParPoints(
  def: Omit<Calculateur, "evaluer"> & { paliers: Palier[] },
): Calculateur {
  const { paliers, ...reste } = def;
  return {
    ...reste,
    evaluer(valeurs) {
      const score = totalPoints(def.champs, valeurs);
      const p = paliers.find((x) => score >= x.min) ?? paliers[paliers.length - 1];
      return { score, libelle: p.libelle, gravite: p.gravite, recommandation: p.recommandation };
    },
  };
}

// Lecture d'un champ numérique : undefined si vide ou non numérique
export const nombre = (valeurs: Valeurs, cle: string) => {
  const v = valeurs[cle];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

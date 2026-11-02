// Calculateurs cliniques décrits par des données : un schéma commun, un évaluateur pur, une interface générique.
// Aucun accès à la base ici, pour pouvoir s'en servir aussi dans le navigateur.

export type Option = { valeur: string; libelle: string; points?: number };

export type Champ =
  | { type: "case"; cle: string; libelle: string; groupe?: string; points?: number; aide?: string }
  | { type: "choix"; cle: string; libelle: string; groupe?: string; options: Option[]; aide?: string };

// Valeurs saisies : booléen pour une case, valeur de l'option retenue pour un choix
export type Valeurs = Record<string, boolean | string | undefined>;

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
  specialite: "cardiologie" | "cardio-oncologie";
  champs: Champ[];
  evaluer: (valeurs: Valeurs) => Resultat;
  notes?: string[]; // limites d'emploi, à afficher sous le résultat
  source: { libelle: string; url: string };
  // Origine des seuils, pour savoir ce qui a été vérifié
  verification: string;
};

// Points d'un champ pour les valeurs données
export function pointsChamp(champ: Champ, valeurs: Valeurs): number {
  const v = valeurs[champ.cle];
  if (champ.type === "case") return v === true ? (champ.points ?? 0) : 0;
  return champ.options.find((o) => o.valeur === v)?.points ?? 0;
}

export function totalPoints(champs: Champ[], valeurs: Valeurs): number {
  return champs.reduce((somme, c) => somme + pointsChamp(c, valeurs), 0);
}

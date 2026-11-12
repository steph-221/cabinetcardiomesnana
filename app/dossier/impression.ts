// Options d'impression des ordonnances, prescriptions et certificats : A5 ou A4, avec ou sans l'en-tête du cabinet
// (sans : pour le papier à en-tête déjà imprimé, la place du haut est laissée libre). Module sans accès base.

export type FormatPapier = "A5" | "A4";
export type OptionsImpression = { format: FormatPapier; entete: boolean };

export const impressionParDefaut: OptionsImpression = { format: "A5", entete: true };

// Lit les paramètres d'adresse ou de formulaire (?format=A4&entete=0) ; toute autre valeur donne le défaut
export function lireImpression(format: unknown, entete: unknown): OptionsImpression {
  return { format: format === "A4" ? "A4" : "A5", entete: entete !== "0" };
}

export const paramsImpression = (o: OptionsImpression) => `format=${o.format}&entete=${o.entete ? 1 : 0}`;

export const libelleImpression = (o: OptionsImpression) => `${o.format} ${o.entete ? "avec en-tête" : "sans en-tête"}`;

// Hauteur laissée libre en haut quand l'en-tête n'est pas imprimé (papier à en-tête du cabinet), en points PDF
export const margeHautePapierEntete: Record<FormatPapier, number> = { A5: 110, A4: 130 };

// Options d'impression de tous les documents du cabinet : A5 ou A4, avec ou sans l'en-tête du cabinet.
// Par défaut : A5 sans en-tête, sur le papier à en-tête du médecin (la place du haut est laissée libre).
// L'en-tête n'est imprimé que si on le demande (?entete=1). Module sans accès base.

export type FormatPapier = "A5" | "A4";
export type OptionsImpression = { format: FormatPapier; entete: boolean };

export const impressionParDefaut: OptionsImpression = { format: "A5", entete: false };

// Copie rangée dans Drive : toujours avec l'en-tête, pour qu'elle reste lisible seule
export const copieArchive = (format: FormatPapier = "A5"): OptionsImpression => ({ format, entete: true });

// Lit les paramètres d'adresse ou de formulaire (?format=A4&entete=1) ; toute autre valeur donne le défaut
export function lireImpression(format: unknown, entete: unknown): OptionsImpression {
  return { format: format === "A4" ? "A4" : "A5", entete: entete === "1" };
}

// Options demandées dans l'adresse d'un PDF (?format=…&entete=…)
export function optionsDemandees(requete: Request): OptionsImpression {
  const demande = new URL(requete.url).searchParams;
  return lireImpression(demande.get("format"), demande.get("entete"));
}

export const paramsImpression = (o: OptionsImpression) => `format=${o.format}&entete=${o.entete ? 1 : 0}`;

export const libelleImpression = (o: OptionsImpression) => `${o.format} ${o.entete ? "avec en-tête" : "sans en-tête"}`;

// Ajoute les options à l'adresse d'un PDF
export const adresseImpression = (adresse: string, o: OptionsImpression) =>
  `${adresse}${adresse.includes("?") ? "&" : "?"}${paramsImpression(o)}`;

// Hauteur laissée libre en haut quand l'en-tête n'est pas imprimé (papier à en-tête du cabinet), en points PDF
// (1 mm = 2,83 points) : 110 points = 39 mm sur A5, 130 points = 46 mm sur A4.
export const margeHautePapierEntete: Record<FormatPapier, number> = { A5: 110, A4: 130 };

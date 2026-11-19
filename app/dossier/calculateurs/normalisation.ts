// Réponses d'un calculateur mises en forme comme à l'écran. Module sans accès base : utilisable dans le navigateur
import type { Calculateur, Valeurs } from "./types";

// Garde seulement les réponses attendues par le calculateur, avec le type prévu.
// Un choix non renseigné prend la première option, comme à l'écran ; un nombre absent reste vide.
export function valeursNormalisees(calculateur: Calculateur, saisie: Record<string, unknown>): Valeurs {
  const propres: Valeurs = {};
  for (const champ of calculateur.champs) {
    const v = saisie[champ.cle];
    if (champ.type === "case") propres[champ.cle] = v === true;
    else if (champ.type === "choix")
      propres[champ.cle] =
        typeof v === "string" && champ.options.some((o) => o.valeur === v) ? v : champ.options[0].valeur;
    else propres[champ.cle] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
  }
  return propres;
}


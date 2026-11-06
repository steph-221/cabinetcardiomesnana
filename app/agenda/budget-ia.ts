// Plafond d'utilisation de l'IA (Claude), par compte : protège la facture Anthropic si un compte est volé ou
// utilisé sans mesure. Les compteurs sont dans le stockage Redis (voir limite.ts) ; sans stockage, pas de plafond.
// Un plafond de dépense doit AUSSI être réglé chez Anthropic (console → Limits) : c'est la dernière barrière.

import { compter } from "./limite";

export const IA_PAR_HEURE = 60;
export const IA_PAR_JOUR = 300;

export const MESSAGE_IA_EPUISEE = `Limite d'utilisation de l'IA atteinte (${IA_PAR_HEURE} demandes par heure, ${IA_PAR_JOUR} par jour). Réessayez plus tard.`;

// Compte une demande à l'IA ; vrai si le compte a dépassé son plafond (la demande doit alors être refusée)
export async function budgetIaEpuise(identifiant: string): Promise<boolean> {
  const [heure, jour] = await Promise.all([
    compter(`ia:h:${identifiant}`, 3600),
    compter(`ia:j:${identifiant}`, 86400),
  ]);
  return (heure ?? 0) > IA_PAR_HEURE || (jour ?? 0) > IA_PAR_JOUR;
}

// Contrôle (sans jamais révéler le mot de passe) de la variable COMPTE_ADMIN = « identifiant:motdepasse ».
// Les comptes créés depuis le site exigent 10 caractères ; l'administrateur, lui, vient d'une variable Vercel
// sans aucune règle : on avertit l'administrateur s'il est trop court plutôt que de lui fermer la porte.

export const LONGUEUR_MIN_ADMIN = 12;

export function evaluerCompteAdmin(valeur: string | undefined): { ok: boolean; probleme?: string } {
  const i = (valeur ?? "").indexOf(":");
  if (!valeur || i < 1) return { ok: false, probleme: "COMPTE_ADMIN est absent ou n'a pas la forme identifiant:motdepasse." };
  if (valeur.length - i - 1 < LONGUEUR_MIN_ADMIN) {
    return { ok: false, probleme: `Le mot de passe administrateur fait moins de ${LONGUEUR_MIN_ADMIN} caractères.` };
  }
  return { ok: true };
}

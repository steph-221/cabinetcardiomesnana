// Réglages du cabinet enregistrés dans la base (clé → valeur)

import { base } from "./base";

export async function lireParametre(cle: string) {
  const sql = await base();
  const [ligne] = await sql`SELECT valeur FROM parametres WHERE cle = ${cle}`;
  return (ligne?.valeur as string | undefined) ?? null;
}

export async function ecrireParametre(cle: string, valeur: string | null) {
  const sql = await base();
  if (valeur === null) await sql`DELETE FROM parametres WHERE cle = ${cle}`;
  else {
    await sql`INSERT INTO parametres (cle, valeur) VALUES (${cle}, ${valeur})
              ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`;
  }
}

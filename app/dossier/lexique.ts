// Lexique du cabinet pour la dictée : quand le médecin corrige un mot mal reconnu, la correction est retenue
// et transmise ensuite à la reconnaissance vocale et à la correction automatique.

import { base } from "./base";

export type EntreeLexique = { id: number; entendu: string; correct: string; creePar: string };

export async function lireLexique(): Promise<EntreeLexique[]> {
  const sql = await base();
  const lignes = await sql`SELECT id, entendu, correct, cree_par FROM lexique ORDER BY lower(correct), lower(entendu)`;
  return lignes.map((l) => ({
    id: l.id as number,
    entendu: l.entendu as string,
    correct: l.correct as string,
    creePar: l.cree_par as string,
  }));
}

// Une même forme entendue n'a qu'une correction : la nouvelle remplace l'ancienne
export async function apprendre(entendu: string, correct: string, par: string) {
  const sql = await base();
  await sql`
    INSERT INTO lexique (entendu, correct, cree_par) VALUES (${entendu}, ${correct}, ${par})
    ON CONFLICT (lower(entendu)) DO UPDATE SET correct = EXCLUDED.correct, cree_par = EXCLUDED.cree_par, cree_le = now()`;
}

export async function oublier(id: number) {
  const sql = await base();
  await sql`DELETE FROM lexique WHERE id = ${id}`;
}

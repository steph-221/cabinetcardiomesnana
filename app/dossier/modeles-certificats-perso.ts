// Modèles de certificats créés par les médecins : un nom et un texte, partagés par tous les médecins du cabinet

import { base } from "./base";
import type { ModelePerso } from "./certificats-modeles";

const versModele = (l: Record<string, unknown>): ModelePerso => ({
  id: l.id as number,
  libelle: l.libelle as string,
  texte: l.texte as string,
});

export async function listerModelesPerso(): Promise<ModelePerso[]> {
  const sql = await base();
  const lignes = await sql`SELECT id, libelle, texte FROM modeles_certificats ORDER BY lower(libelle), id`;
  return lignes.map(versModele);
}

export async function lireModelePerso(id: number): Promise<ModelePerso | null> {
  const sql = await base();
  const [ligne] = await sql`SELECT id, libelle, texte FROM modeles_certificats WHERE id = ${id}`;
  return ligne ? versModele(ligne) : null;
}

export async function creerModelePerso(libelle: string, texte: string, par: string): Promise<ModelePerso> {
  const sql = await base();
  const [ligne] = await sql`
    INSERT INTO modeles_certificats (libelle, texte, cree_par) VALUES (${libelle}, ${texte}, ${par})
    RETURNING id, libelle, texte`;
  return versModele(ligne);
}

export async function modifierModelePerso(id: number, libelle: string, texte: string): Promise<ModelePerso | null> {
  const sql = await base();
  const [ligne] = await sql`
    UPDATE modeles_certificats SET libelle = ${libelle}, texte = ${texte} WHERE id = ${id}
    RETURNING id, libelle, texte`;
  return ligne ? versModele(ligne) : null;
}

export async function supprimerModelePerso(id: number) {
  const sql = await base();
  await sql`DELETE FROM modeles_certificats WHERE id = ${id}`;
}

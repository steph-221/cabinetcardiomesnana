// Copie privée des sites suivis dans le Google Drive du cabinet, pour le seul usage du médecin (jamais republiée).
// Quand la copie d'un site est activée, sa page de liste et chacune de ses publications entrent dans une file ;
// chaque page copiée y ajoute les documents qu'elle propose (PDF, diaporamas…). La file est traitée par lots
// (copie-lot.ts, appelé par la route /api/bibliotheque/copie). Ce module-ci ne fait que gérer la file : il ne
// charge pas le navigateur, et peut donc servir à toutes les pages.

import { base } from "./base";

export type StatutCopie = "a_copier" | "en_cours" | "copiee" | "erreur" | "bloquee";

export type CopieSite = {
  id: number;
  siteId: number;
  publicationId: number | null;
  parentId: number | null;
  profondeur: number;
  url: string;
  genre: "" | "page" | "fichier";
  titre: string;
  statut: StatutCopie;
  erreur: string;
  mime: string;
  taille: number;
  copieeLe: Date | null;
  indexee: boolean;
};

export async function listerCopies(): Promise<CopieSite[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT c.id, c.site_id, c.publication_id, c.parent_id, c.profondeur, c.url, c.genre, c.titre, c.statut,
      c.erreur, c.mime, c.taille, c.copiee_le, EXISTS (SELECT 1 FROM sources s WHERE s.copie_id = c.id) AS indexee
    FROM copies c ORDER BY c.profondeur, c.id`;
  return lignes.map((l) => ({
    id: l.id as number,
    siteId: l.site_id as number,
    publicationId: l.publication_id as number | null,
    parentId: l.parent_id as number | null,
    profondeur: l.profondeur as number,
    url: l.url as string,
    genre: l.genre as CopieSite["genre"],
    titre: l.titre as string,
    statut: l.statut as StatutCopie,
    erreur: l.erreur as string,
    mime: l.mime as string,
    taille: Number(l.taille),
    copieeLe: l.copiee_le as Date | null,
    indexee: l.indexee as boolean,
  }));
}

export async function lireCopie(id: number) {
  const sql = await base();
  const [l] =
    await sql`SELECT titre, genre, drive_id, mime, taille, url FROM copies WHERE id = ${id} AND statut = 'copiee'`;
  if (!l || !l.drive_id) return null;
  return {
    titre: l.titre as string,
    genre: l.genre as CopieSite["genre"],
    driveId: l.drive_id as string,
    mime: l.mime as string,
    taille: Number(l.taille),
    url: l.url as string,
  };
}

// Met en file la page de liste et toutes les publications du site (si sa copie est activée). Avec `tout`, ce qui
// est déjà copié, en erreur ou bloqué est aussi repris : les pages modifiées depuis sont recopiées.
export async function mettreEnFile(siteId: number, tout = false) {
  const sql = await base();
  await sql`
    INSERT INTO copies (site_id, url, profondeur)
    SELECT id, adresse, 0 FROM sites_suivis WHERE id = ${siteId} AND copie
    ON CONFLICT (site_id, url) DO NOTHING`;
  await sql`
    INSERT INTO copies (site_id, publication_id, url, profondeur)
    SELECT p.site_id, p.id, p.url, 1
    FROM publications p JOIN sites_suivis s ON s.id = p.site_id AND s.copie
    WHERE p.site_id = ${siteId}
    ON CONFLICT (site_id, url) DO UPDATE SET
      publication_id = COALESCE(copies.publication_id, EXCLUDED.publication_id),
      profondeur = LEAST(copies.profondeur, EXCLUDED.profondeur)`;
  if (tout) {
    await sql`
      UPDATE copies SET statut = 'a_copier', essais = 0, erreur = ''
      WHERE site_id = ${siteId} AND statut IN ('copiee', 'erreur', 'bloquee')`;
  }
}

export async function activerCopie(siteId: number) {
  const sql = await base();
  await sql`UPDATE sites_suivis SET copie = true WHERE id = ${siteId}`;
  await mettreEnFile(siteId);
}

// Arrête la copie du site : ce qui restait à copier est retiré de la file ; les copies faites restent dans Drive
export async function arreterCopie(siteId: number) {
  const sql = await base();
  await sql`UPDATE sites_suivis SET copie = false WHERE id = ${siteId}`;
  await sql`DELETE FROM copies WHERE site_id = ${siteId} AND statut IN ('a_copier', 'en_cours')`;
}

export async function compterEnFile(siteId: number) {
  const sql = await base();
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM copies c JOIN sites_suivis s ON s.id = c.site_id AND s.copie
    WHERE c.site_id = ${siteId} AND c.statut IN ('a_copier', 'en_cours')`;
  return n as number;
}

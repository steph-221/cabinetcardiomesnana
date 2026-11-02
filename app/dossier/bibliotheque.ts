// Bibliothèque de références de l'assistant : recommandations (ESC…), RCP des médicaments, articles, protocoles
// et fiches validées par le médecin. Le texte est importé page par page, découpé en passages et indexé en plein
// texte (Postgres) dans la langue de la source. Une source ajoutée à la main ne garde que son texte et le lien vers
// sa version officielle, ouvert à la bonne page ; une source venue de la copie d'un site suivi renvoie aussi à sa
// copie privée, rangée dans le Google Drive du cabinet (voir copies.ts).

import { base } from "./base";
import { decouper, requeteRecherche } from "./decoupage";
import type { TypeSource } from "./sources";

export { estTypeSource, libelleSource, lienPage, typesSource, type TypeSource } from "./sources";

export type Source = {
  id: number;
  titre: string;
  organisme: string;
  annee: number | null;
  type: TypeSource;
  langue: "fr" | "en";
  statut: "en_vigueur" | "remplacee";
  url: string;
  pages: number;
  complete: boolean;
  passages: number;
  copieId: number | null;
  creeLe: Date;
  creePar: string;
};

export type NouvelleSource = Pick<Source, "titre" | "organisme" | "annee" | "type" | "langue" | "url"> & {
  publicationId: number | null;
  copieId?: number | null;
};

export type Passage = {
  id: number;
  page: number | null;
  texte: string;
  source: Pick<Source, "id" | "titre" | "organisme" | "annee" | "type" | "url" | "copieId">;
};

const configuration = (langue: "fr" | "en") => (langue === "en" ? "english" : "french");

export async function listerSources(): Promise<Source[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT s.*, (SELECT count(*) FROM passages p WHERE p.source_id = s.id)::int AS nb
    FROM sources s ORDER BY s.statut, s.type, s.annee DESC NULLS LAST, s.titre`;
  return lignes.map((l) => ({
    id: l.id as number,
    titre: l.titre as string,
    organisme: l.organisme as string,
    annee: l.annee as number | null,
    type: l.type as TypeSource,
    langue: l.langue as "fr" | "en",
    statut: l.statut as Source["statut"],
    url: l.url as string,
    pages: l.pages as number,
    complete: l.complete as boolean,
    passages: l.nb as number,
    copieId: (l.copie_id as number | null) ?? null,
    creeLe: l.cree_le as Date,
    creePar: l.cree_par as string,
  }));
}

export async function creerSource(s: NouvelleSource, par: string) {
  const sql = await base();
  const [ligne] = await sql`
    INSERT INTO sources (titre, organisme, annee, type, langue, url, publication_id, copie_id, cree_par)
    VALUES (${s.titre}, ${s.organisme}, ${s.annee}, ${s.type}, ${s.langue}, ${s.url},
      (SELECT id FROM publications WHERE id = ${s.publicationId}), ${s.copieId ?? null}, ${par})
    RETURNING id`;
  return ligne.id as number;
}

// Ajoute le texte de quelques pages (l'import se fait par lots, depuis le navigateur)
export async function ajouterPages(sourceId: number, pages: { page: number | null; texte: string }[]) {
  const sql = await base();
  const [source] = await sql`SELECT langue FROM sources WHERE id = ${sourceId} AND NOT complete`;
  if (!source) return 0;
  const config = configuration(source.langue as "fr" | "en");
  const passages = pages.flatMap(({ page, texte }) => decouper(texte).map((t) => ({ page, texte: t })));
  if (!passages.length) return 0;
  await sql`
    INSERT INTO passages (source_id, page, texte, tsv)
    SELECT ${sourceId}, p.page, p.texte, to_tsvector(${config}::regconfig, p.texte)
    FROM jsonb_to_recordset(${JSON.stringify(passages)}::jsonb) AS p(page integer, texte text)`;
  return passages.length;
}

export async function terminerSource(sourceId: number, pages: number) {
  const sql = await base();
  const [ligne] = await sql`
    UPDATE sources SET complete = true, pages = ${pages}
    WHERE id = ${sourceId} AND EXISTS (SELECT 1 FROM passages WHERE source_id = ${sourceId})
    RETURNING id`;
  return Boolean(ligne);
}

export async function changerStatut(sourceId: number, statut: Source["statut"]) {
  const sql = await base();
  await sql`UPDATE sources SET statut = ${statut} WHERE id = ${sourceId}`;
}

export async function supprimerSource(sourceId: number) {
  const sql = await base();
  await sql`DELETE FROM sources WHERE id = ${sourceId}`;
}

// Recherche des passages les plus pertinents parmi les sources en vigueur et complètes. Les termes sont donnés
// en anglais et en français : chaque source est interrogée dans sa langue.
export async function rechercherPassages(termes: { en: string[]; fr: string[] }, limite = 16): Promise<Passage[]> {
  const en = requeteRecherche(termes.en);
  const fr = requeteRecherche(termes.fr);
  if (!en && !fr) return [];
  const sql = await base();
  const lignes = await sql`
    SELECT p.id, p.page, p.texte, s.id AS source_id, s.titre, s.organisme, s.annee, s.type, s.url, s.copie_id,
      ts_rank_cd(p.tsv, q.requete, 1) AS rang
    FROM passages p
    JOIN sources s ON s.id = p.source_id AND s.complete AND s.statut = 'en_vigueur'
    CROSS JOIN LATERAL (
      SELECT CASE s.langue
        WHEN 'en' THEN websearch_to_tsquery('english', ${en})
        ELSE websearch_to_tsquery('french', ${fr})
      END AS requete
    ) q
    WHERE p.tsv @@ q.requete
    ORDER BY rang DESC, p.id
    LIMIT ${limite}`;
  return lignes.map((l) => ({
    id: l.id as number,
    page: l.page as number | null,
    texte: l.texte as string,
    source: {
      id: l.source_id as number,
      titre: l.titre as string,
      organisme: l.organisme as string,
      annee: l.annee as number | null,
      type: l.type as TypeSource,
      url: l.url as string,
      copieId: (l.copie_id as number | null) ?? null,
    },
  }));
}

// --- Sources venues de la copie d'un site suivi ---

// Vrai si la publication a déjà été ajoutée à la main : sa copie n'est alors pas indexée une seconde fois
export async function sourceManuelle(publicationId: number) {
  const sql = await base();
  const [ligne] = await sql`SELECT 1 FROM sources WHERE publication_id = ${publicationId} AND copie_id IS NULL LIMIT 1`;
  return Boolean(ligne);
}

// Indexe (ou réindexe, quand la page a changé) le texte d'une copie. L'ancienne version est retirée.
export async function remplacerSourceCopie(
  copieId: number,
  source: Omit<NouvelleSource, "copieId">,
  pages: { page: number | null; texte: string }[],
) {
  const sql = await base();
  await sql`DELETE FROM sources WHERE copie_id = ${copieId}`;
  const id = await creerSource({ ...source, copieId }, "copie automatique");
  // Par lots, pour ne pas envoyer en une fois le texte d'une recommandation entière
  for (let i = 0; i < pages.length; i += 40) await ajouterPages(id, pages.slice(i, i + 40));
  if (!(await terminerSource(id, pages.length))) await supprimerSource(id);
}

// Bibliothèque de références de l'assistant : recommandations (ESC…), RCP des médicaments, articles, protocoles
// et fiches validées par le médecin. Le texte est importé page par page, découpé en passages et indexé en plein
// texte (Postgres) dans la langue de la source. Les PDF eux-mêmes ne sont pas conservés : chaque source garde le
// lien vers sa version officielle, ouvert à la bonne page.

import { base } from "./base";
import { decouper, requeteRecherche } from "./decoupage";
import { themesDe } from "./themes";
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
  doi: string;
  creeLe: Date;
  creePar: string;
};

export type NouvelleSource = Pick<Source, "titre" | "organisme" | "annee" | "type" | "langue" | "url"> & {
  publicationId: number | null;
  doi?: string;
};

export type Passage = {
  id: number;
  page: number | null;
  texte: string;
  source: Pick<Source, "id" | "titre" | "organisme" | "annee" | "type" | "url">;
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
    doi: (l.doi as string) ?? "",
    creeLe: l.cree_le as Date,
    creePar: l.cree_par as string,
  }));
}

export async function creerSource(s: NouvelleSource, par: string) {
  const sql = await base();
  const [ligne] = await sql`
    INSERT INTO sources (titre, organisme, annee, type, langue, url, publication_id, doi, cree_par)
    VALUES (${s.titre}, ${s.organisme}, ${s.annee}, ${s.type}, ${s.langue}, ${s.url},
      (SELECT id FROM publications WHERE id = ${s.publicationId}), ${s.doi ?? ""}, ${par})
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
    SELECT p.id, p.page, p.texte, s.id AS source_id, s.titre, s.organisme, s.annee, s.type, s.url,
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
    },
  }));
}

// Un passage avec sa source : pour ouvrir « le passage cité » depuis un compte rendu ou la vérification des seuils
export async function lirePassage(id: number): Promise<Passage | null> {
  const sql = await base();
  const [l] = await sql`
    SELECT p.id, p.page, p.texte, s.id AS source_id, s.titre, s.organisme, s.annee, s.type, s.url
    FROM passages p JOIN sources s ON s.id = p.source_id WHERE p.id = ${id}`;
  return l
    ? {
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
        },
      }
    : null;
}

// Source déjà importée pour ce DOI (évite d'importer deux fois le même document)
export async function sourceParDoi(doi: string) {
  if (!doi) return null;
  const sql = await base();
  const [l] = await sql`SELECT id, titre, annee, statut FROM sources WHERE doi = ${doi} ORDER BY id DESC LIMIT 1`;
  return l ? { id: l.id as number, titre: l.titre as string, annee: l.annee as number | null, statut: l.statut as string } : null;
}

// Versions plus anciennes à marquer « remplacée » quand une nouvelle édition est ajoutée : même organisme, même type,
// année antérieure, au moins un thème clinique en commun et, pour une recommandation, le même sujet dans le titre.
export async function sourcesRemplacables(id: number) {
  const sql = await base();
  const [neuve] = await sql`SELECT titre, organisme, annee, type FROM sources WHERE id = ${id}`;
  if (!neuve || neuve.annee === null || neuve.type !== "recommandation") return [];
  const anciennes = await sql`
    SELECT id, titre, organisme, annee FROM sources
    WHERE id <> ${id} AND statut = 'en_vigueur' AND type = 'recommandation'
      AND lower(organisme) = lower(${neuve.organisme}) AND annee < ${neuve.annee}`;
  const mots = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/[a-z]{5,}/g) ?? []);
  const communsNeuve = new Set(themesDe(neuve.titre as string));
  const motsNeuve = mots(neuve.titre as string);
  return anciennes
    .filter((a) => {
      const t = themesDe(a.titre as string);
      const partages = [...mots(a.titre as string)].filter((m) => motsNeuve.has(m) && !["guidelines", "management", "diagnosis", "treatment"].includes(m));
      return t.some((x) => communsNeuve.has(x)) && partages.length >= 1;
    })
    .map((a) => ({ id: a.id as number, titre: a.titre as string, annee: a.annee as number | null }));
}

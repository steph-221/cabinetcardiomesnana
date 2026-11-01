// Traitement par lots de la file de copie des sites suivis (voir copies.ts) : chaque adresse est copiée (page
// ouverte dans le navigateur sans fenêtre, ou fichier téléchargé), rangée dans le Google Drive du cabinet, puis son
// texte entre dans la bibliothèque. Une pause sépare deux adresses pour ne pas surcharger les sites.
// Seule la route /api/bibliotheque/copie importe ce module : elle seule embarque Chromium.

import { createHash } from "node:crypto";
import type { Browser } from "playwright-core";
import { base } from "./base";
import { remplacerSourceCopie, sourceManuelle } from "./bibliotheque";
import { copierAdresse, CopieBloquee, documentsLies, type Copie } from "./copie-site";
import { compterEnFile } from "./copies";
import { envoyerCopie, ErreurDrive, expliquerErreurDrive, mettreALaCorbeille } from "./drive";
import { ouvrirNavigateur } from "./navigateur";
import type { TypeSource } from "./sources";

// Durée d'un lot (la route a 300 secondes au plus) et pause entre deux adresses
const DUREE_LOT = 100_000;
const PAUSE = 1_000;
// Une adresse dont la copie a été interrompue trois fois (page trop lourde…) est laissée de côté
const ESSAIS_MAX = 3;

type Element = {
  id: number;
  url: string;
  profondeur: number;
  publicationId: number | null;
  lien: string;
  driveId: string;
  empreinte: string;
  titrePublication: string | null;
  anneePublication: number | null;
  titreParent: string | null;
  site: { id: number; nom: string; organisme: string; type: TypeSource; langue: "fr" | "en" };
};

// Prend l'adresse suivante de la file. Une adresse restée « en cours » plus de 10 minutes (lot interrompu) est
// reprise, au plus trois fois.
async function prendreSuivante(siteId: number): Promise<Element | null> {
  const sql = await base();
  await sql`
    UPDATE copies SET statut = 'erreur', erreur = 'La copie a été interrompue plusieurs fois (page trop lourde ?).'
    WHERE site_id = ${siteId} AND statut = 'en_cours' AND pris_le < now() - interval '10 minutes'
      AND essais >= ${ESSAIS_MAX}`;
  const [l] = await sql`
    WITH suivante AS (
      UPDATE copies SET statut = 'en_cours', pris_le = now(), essais = essais + 1
      WHERE id = (
        SELECT c.id FROM copies c JOIN sites_suivis s ON s.id = c.site_id AND s.copie
        WHERE c.site_id = ${siteId}
          AND (c.statut = 'a_copier' OR (c.statut = 'en_cours' AND c.pris_le < now() - interval '10 minutes'))
        ORDER BY c.profondeur, c.id
        LIMIT 1
        FOR UPDATE OF c SKIP LOCKED
      )
      RETURNING *
    )
    SELECT c.*, p.titre AS titre_publication, p.annee AS annee_publication, parent.titre AS titre_parent,
      s.nom, s.organisme, s.type, s.langue
    FROM suivante c
    JOIN sites_suivis s ON s.id = c.site_id
    LEFT JOIN publications p ON p.id = c.publication_id
    LEFT JOIN copies parent ON parent.id = c.parent_id`;
  if (!l) return null;
  return {
    id: l.id as number,
    url: l.url as string,
    profondeur: l.profondeur as number,
    publicationId: l.publication_id as number | null,
    lien: l.lien as string,
    driveId: l.drive_id as string,
    empreinte: l.empreinte as string,
    titrePublication: l.titre_publication as string | null,
    anneePublication: l.annee_publication as number | null,
    titreParent: l.titre_parent as string | null,
    site: {
      id: l.site_id as number,
      nom: l.nom as string,
      organisme: l.organisme as string,
      type: l.type as TypeSource,
      langue: l.langue as "fr" | "en",
    },
  };
}

const empreinte = (donnees: string | Uint8Array) => createHash("sha256").update(donnees).digest("hex");

async function lirePdf(donnees: Uint8Array) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(donnees.slice());
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((texte, i) => ({ page: i + 1, texte }));
}

const anneeDe = (texte: string) => {
  const m = texte.match(/\b(19[5-9]\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
};

// Le texte d'une publication copiée (sa page, ses PDF) entre dans la bibliothèque. La page de liste n'est pas
// indexée (ce n'est qu'un sommaire), ni une publication déjà ajoutée à la main.
async function indexer(element: Element, copie: Copie) {
  if (element.profondeur === 0) return;
  if (element.publicationId && (await sourceManuelle(element.publicationId))) return;
  let pages: { page: number | null; texte: string }[] = [];
  if (copie.genre === "page") pages = [{ page: null, texte: copie.texte }];
  else if (copie.mime === "application/pdf") pages = await lirePdf(copie.donnees).catch(() => []);
  if (pages.reduce((n, p) => n + p.texte.trim().length, 0) < 800) return;

  const principal = element.titrePublication ?? element.titreParent;
  const titre =
    copie.genre === "page"
      ? (element.titrePublication ?? copie.titre)
      : [principal, element.lien && element.lien.length < 80 ? element.lien : copie.titre].filter(Boolean).join(" — ");
  await remplacerSourceCopie(
    element.id,
    {
      titre: titre.slice(0, 200),
      organisme: element.site.organisme,
      annee: element.anneePublication ?? anneeDe(`${principal ?? ""} ${copie.titre}`),
      type: element.site.type,
      langue: element.site.langue,
      url: element.url,
      publicationId: element.publicationId,
    },
    pages,
  );
}

// Les erreurs de Google Drive arrêtent le lot : l'adresse retourne dans la file
const erreurDrive = (e: unknown) => e instanceof ErreurDrive || (e instanceof Error && /Google Drive/.test(e.message));

async function traiter(element: Element, navigateur: () => Promise<Browser>) {
  const sql = await base();
  let copie: Copie;
  try {
    copie = await copierAdresse(element.url, navigateur);
  } catch (erreur) {
    const bloquee = erreur instanceof CopieBloquee;
    const message =
      erreur instanceof Error && erreur.message.length < 200 && !/^page\.|browser|playwright/i.test(erreur.message)
        ? erreur.message
        : "Copie impossible.";
    if (!bloquee) console.error(element.url, erreur);
    await sql`
      UPDATE copies SET statut = ${bloquee ? "bloquee" : "erreur"}, erreur = ${message} WHERE id = ${element.id}`;
    return { titre: element.titrePublication ?? element.url, statut: bloquee ? "bloquee" : "erreur", erreur: message };
  }

  const donnees = copie.genre === "page" ? new TextEncoder().encode(copie.html) : copie.donnees;
  const signature = empreinte(copie.genre === "page" ? copie.texte : copie.donnees);
  const nom = copie.genre === "page" ? `${copie.titre}.html` : copie.nom;
  const mime = copie.genre === "page" ? "text/html" : copie.mime;

  // Contenu inchangé depuis la dernière copie : rien à renvoyer dans Drive
  const inchange = Boolean(element.driveId) && element.empreinte === signature;
  try {
    let driveId = element.driveId;
    if (!inchange) {
      driveId = await envoyerCopie(element.site, nom, new Blob([Buffer.from(donnees)], { type: mime }));
      if (element.driveId) await mettreALaCorbeille(element.driveId).catch(() => {});
    }
    await sql`
      UPDATE copies SET statut = 'copiee', genre = ${copie.genre}, titre = ${copie.genre === "page" ? copie.titre : copie.nom}, drive_id = ${driveId},
        mime = ${mime}, taille = ${donnees.length}, empreinte = ${signature}, erreur = '', copiee_le = now()
      WHERE id = ${element.id}`;
  } catch (erreur) {
    await sql`UPDATE copies SET statut = 'a_copier', essais = essais - 1 WHERE id = ${element.id}`;
    throw erreur;
  }

  // Documents proposés par la page de liste et par les pages des publications (pas au-delà)
  if (copie.genre === "page" && element.profondeur <= 1) {
    const documents = documentsLies(copie.liens);
    if (documents.length) {
      await sql`
        INSERT INTO copies (site_id, publication_id, parent_id, url, lien, profondeur)
        SELECT ${element.site.id}, ${element.publicationId}, ${element.id}, d.url, d.texte, ${element.profondeur + 1}
        FROM jsonb_to_recordset(${JSON.stringify(documents)}::jsonb) AS d(url text, texte text)
        ON CONFLICT (site_id, url) DO NOTHING`;
    }
  }

  if (!inchange) {
    await indexer(element, copie).catch((erreur) => console.error("indexation", element.url, erreur));
  }
  return { titre: element.titrePublication ?? copie.titre, statut: "copiee", erreur: "" };
}

export type ResultatLot =
  | { faites: { titre: string; statut: string; erreur: string }[]; restantes: number }
  | { erreur: string };

// Copie les adresses en attente pendant environ 100 secondes, puis rend la main (la page relance un lot)
export async function copierUnLot(siteId: number): Promise<ResultatLot> {
  const debut = Date.now();
  let navigateur: Browser | null = null;
  const ouvrir = async () => (navigateur ??= await ouvrirNavigateur());
  const faites: { titre: string; statut: string; erreur: string }[] = [];
  try {
    while (Date.now() - debut < DUREE_LOT) {
      const element = await prendreSuivante(siteId);
      if (!element) break;
      faites.push(await traiter(element, ouvrir));
      await new Promise((r) => setTimeout(r, PAUSE));
    }
  } catch (erreur) {
    if (erreurDrive(erreur)) return { erreur: expliquerErreurDrive(erreur) };
    throw erreur;
  } finally {
    await (navigateur as Browser | null)?.close().catch(() => {});
  }
  return { faites, restantes: await compterEnFile(siteId) };
}

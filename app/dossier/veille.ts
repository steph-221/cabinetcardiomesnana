// Sites et revues suivis par la bibliothèque : pages de liste (recommandations de l'ESC…) ou flux RSS de revues.
// Leur liste de publications est relue régulièrement : chaque nouvelle publication apparaît avec un lien vers sa
// version officielle, que le médecin ouvre (avec son abonnement si besoin) puis ajoute à la bibliothèque.
// Les accès abonnés (identifiant, mot de passe) sont chiffrés dans la base et ne sont affichés qu'à la demande.

import { base } from "./base";
import { chiffrer, dechiffrer } from "./chiffrement";
import { lireSite } from "./lecture-site";
import type { TypeSource } from "./sources";

export type Publication = {
  id: number;
  titre: string;
  url: string;
  annee: number | null;
  publieLe: Date | null;
  vueLe: Date;
  nouvelle: boolean;
  importee: boolean;
};

export type SiteSuivi = {
  id: number;
  nom: string;
  adresse: string;
  prefixe: string;
  organisme: string;
  type: TypeSource;
  langue: "fr" | "en";
  accesUrl: string;
  identifiant: string;
  motDePasse: boolean;
  verifieLe: Date | null;
  erreur: string;
  publications: Publication[];
};

export type NouveauSite = Pick<SiteSuivi, "nom" | "adresse" | "prefixe" | "organisme" | "type" | "langue">;

// Une publication reste signalée « nouvelle » pendant 60 jours, tant qu'elle n'est pas dans la bibliothèque
const JOURS_NOUVEAUTE = 60;
// Les sites sont relus au plus une fois par jour, à l'ouverture de la page
export const DELAI_VERIFICATION = 24 * 3600 * 1000;

export async function listerSites(): Promise<SiteSuivi[]> {
  const sql = await base();
  const [sites, publications] = await Promise.all([
    sql`SELECT * FROM sites_suivis ORDER BY nom`,
    sql`
      SELECT p.*, EXISTS (SELECT 1 FROM sources s WHERE s.publication_id = p.id) AS importee
      FROM publications p
      ORDER BY p.publie_le DESC NULLS LAST, p.annee DESC NULLS LAST, p.vue_le DESC, p.titre`,
  ]);
  const limite = Date.now() - JOURS_NOUVEAUTE * 24 * 3600 * 1000;
  return sites.map((s) => ({
    id: s.id as number,
    nom: s.nom as string,
    adresse: s.adresse as string,
    prefixe: s.prefixe as string,
    organisme: s.organisme as string,
    type: s.type as TypeSource,
    langue: s.langue as "fr" | "en",
    accesUrl: s.acces_url as string,
    identifiant: s.identifiant ? dechiffrer(s.identifiant as string) : "",
    motDePasse: Boolean(s.mot_de_passe),
    verifieLe: s.verifie_le as Date | null,
    erreur: s.erreur as string,
    publications: publications
      .filter((p) => p.site_id === s.id)
      .map((p) => ({
        id: p.id as number,
        titre: p.titre as string,
        url: p.url as string,
        annee: p.annee as number | null,
        publieLe: p.publie_le as Date | null,
        vueLe: p.vue_le as Date,
        nouvelle: (p.nouvelle as boolean) && !p.importee && (p.vue_le as Date).getTime() > limite,
        importee: p.importee as boolean,
      })),
  }));
}

// Nombre de nouvelles publications pas encore ajoutées, pour le lien depuis la bibliothèque
export async function compterNouveautes() {
  const sql = await base();
  const [ligne] = await sql`
    SELECT count(*)::int AS n FROM publications p
    WHERE p.nouvelle AND p.vue_le > now() - make_interval(days => ${JOURS_NOUVEAUTE})
      AND NOT EXISTS (SELECT 1 FROM sources s WHERE s.publication_id = p.id)`;
  return ligne.n as number;
}

// Publication et site d'origine, pour pré-remplir l'ajout à la bibliothèque
export async function lirePublication(id: number) {
  const sql = await base();
  const [l] = await sql`
    SELECT p.id, p.titre, p.url, p.annee, s.organisme, s.type, s.langue
    FROM publications p JOIN sites_suivis s ON s.id = p.site_id WHERE p.id = ${id}`;
  if (!l) return null;
  return {
    id: l.id as number,
    titre: l.titre as string,
    url: l.url as string,
    annee: l.annee as number | null,
    organisme: l.organisme as string,
    type: l.type as TypeSource,
    langue: l.langue as "fr" | "en",
  };
}

export async function creerSite(s: NouveauSite, par: string) {
  const sql = await base();
  const [ligne] = await sql`
    INSERT INTO sites_suivis (nom, adresse, prefixe, organisme, type, langue, cree_par)
    VALUES (${s.nom}, ${s.adresse}, ${s.prefixe}, ${s.organisme}, ${s.type}, ${s.langue}, ${par})
    RETURNING id`;
  return ligne.id as number;
}

export async function supprimerSite(id: number) {
  const sql = await base();
  await sql`DELETE FROM sites_suivis WHERE id = ${id}`;
}

// Enregistre l'accès abonné. Un mot de passe vide garde celui déjà enregistré, sauf si `effacer` est demandé.
export async function enregistrerAcces(
  id: number,
  acces: { url: string; identifiant: string; motDePasse: string; effacer: boolean },
) {
  const sql = await base();
  const identifiant = acces.identifiant ? chiffrer(acces.identifiant) : "";
  const motDePasse = acces.motDePasse ? chiffrer(acces.motDePasse) : null;
  await sql`
    UPDATE sites_suivis SET
      acces_url = ${acces.url},
      identifiant = ${identifiant},
      mot_de_passe = CASE WHEN ${acces.effacer} THEN '' ELSE COALESCE(${motDePasse}, mot_de_passe) END
    WHERE id = ${id}`;
}

export async function lireMotDePasse(id: number) {
  const sql = await base();
  const [l] = await sql`SELECT nom, mot_de_passe FROM sites_suivis WHERE id = ${id}`;
  if (!l || !l.mot_de_passe) return null;
  return { nom: l.nom as string, motDePasse: dechiffrer(l.mot_de_passe as string) };
}

// Relit la liste des publications d'un site. À la première lecture, tout ce qui est trouvé est l'existant ; ensuite,
// ce qui apparaît est marqué nouveau. Les publications retirées du site restent dans la liste.
export async function verifierSite(id: number): Promise<{ trouvees: number; nouvelles: number } | { erreur: string }> {
  const sql = await base();
  const [site] = await sql`SELECT adresse, prefixe, verifie_le FROM sites_suivis WHERE id = ${id}`;
  if (!site) return { trouvees: 0, nouvelles: 0 };
  try {
    const lues = await lireSite(site.adresse as string, site.prefixe as string);
    if (!lues.length) throw new Error("Aucune publication trouvée à cette adresse.");
    const premiere = !site.verifie_le;
    const [{ n }] = await sql`
      WITH ajout AS (
        INSERT INTO publications (site_id, titre, url, annee, publie_le, nouvelle)
        SELECT ${id}, p.titre, p.url, p.annee, p."publieLe", ${!premiere}
        FROM jsonb_to_recordset(${JSON.stringify(lues)}::jsonb)
          AS p(titre text, url text, annee integer, "publieLe" timestamptz)
        ON CONFLICT (site_id, url) DO UPDATE SET titre = EXCLUDED.titre, annee = EXCLUDED.annee,
          publie_le = COALESCE(EXCLUDED.publie_le, publications.publie_le)
        RETURNING (xmax = 0) AS inseree
      )
      SELECT count(*) FILTER (WHERE inseree)::int AS n FROM ajout`;
    await sql`UPDATE sites_suivis SET verifie_le = now(), erreur = '' WHERE id = ${id}`;
    return { trouvees: lues.length, nouvelles: premiere ? 0 : (n as number) };
  } catch (erreur) {
    const message = erreur instanceof Error && erreur.message.length < 200 ? erreur.message : "Lecture impossible.";
    await sql`UPDATE sites_suivis SET verifie_le = now(), erreur = ${message} WHERE id = ${id}`;
    return { erreur: message };
  }
}

// Sites dont la liste n'a pas été relue depuis un jour
export async function sitesARelire() {
  const sql = await base();
  const lignes = await sql`
    SELECT id FROM sites_suivis
    WHERE verifie_le IS NULL OR verifie_le < now() - make_interval(secs => ${DELAI_VERIFICATION / 1000})`;
  return lignes.map((l) => l.id as number);
}

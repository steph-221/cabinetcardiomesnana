// Veille de medicament.ma : copie des fiches en base, « carte du site » relue par lettre (nom, présentation, prix,
// laboratoire de chaque médicament), journal des changements et alertes sur les médicaments prescrits.
//
// Principes de prudence : la lecture ne retire jamais un médicament sur un simple doute. Une lettre illisible,
// une structure de page inattendue, une liste anormalement courte ou un retrait en masse sont signalés « doute »
// (avec la raison) sans rien supprimer ; un retrait n'est enregistré que si la fiche elle-même répond
// « médicament non trouvé ». Les pages qui ne répondent pas sont signalées « inaccessible » avec la cause.

import { base } from "./base";
import {
  adresseListe,
  differences,
  lectureSuspecte,
  lireFiche,
  lireListe,
  type Fiche,
  type LigneListe,
} from "./lecture-medicament-ma";
import medicamentsInitiaux from "./medicaments-ma.json";

export const LETTRES = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const DELAI_PAGE = 20_000;
const PAGES_MAX = 80;
const PARALLELE = 4;
// Une vérification complète est relancée si la dernière date de plus d'un jour
export const DELAI_VERIFICATION = 24 * 3600 * 1000;

export type TypeChangement = "ajout" | "retrait" | "modification" | "inaccessible" | "doute";

export type Changement = {
  id: number;
  url: string;
  nom: string;
  type: TypeChangement;
  detail: string;
  detecteLe: Date;
  patients: number; // patients à qui ce médicament a été prescrit
};

export type EtatVeille = {
  termineLe: Date | null;
  enCours: boolean;
  lettresFaites: number;
  total: number;
};

// --- Lecture réseau -------------------------------------------------------------------------------------------

type Lecture = { html: string; statut: number } | { erreur: string };

// Seul medicament.ma est interrogé (adresses construites ici ou issues de ses propres liens)
async function lire(url: string): Promise<Lecture> {
  if (!url.startsWith("https://medicament.ma/")) return { erreur: "Adresse hors medicament.ma" };
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(DELAI_PAGE),
      headers: { "user-agent": "cabinet-veille-medicaments", accept: "text/html" },
      redirect: "follow",
    });
    const html = await r.text();
    // Le site renvoie parfois la vraie fiche avec un statut 404 : le contenu décide, pas le code
    if (r.ok || r.status === 404) return { html, statut: r.status };
    return { erreur: r.status >= 500 ? `le site répond une erreur serveur (${r.status})` : `le site répond ${r.status}` };
  } catch (e) {
    const nom = e instanceof Error ? e.name : "";
    return { erreur: nom === "TimeoutError" || nom === "AbortError" ? "délai dépassé : le site ne répond pas" : "connexion impossible au site" };
  }
}

// --- Journal ---------------------------------------------------------------------------------------------------

async function noter(type: TypeChangement, url: string, nom: string, detail: string) {
  const sql = await base();
  // Pas de doublon tant qu'un signalement identique n'est pas traité
  await sql`
    INSERT INTO medicaments_changements (url, nom, type, detail)
    SELECT ${url}, ${nom}, ${type}, ${detail}
    WHERE NOT EXISTS (
      SELECT 1 FROM medicaments_changements
      WHERE url = ${url} AND type = ${type} AND detail = ${detail} AND traite_le IS NULL)`;
}

// --- Base ----------------------------------------------------------------------------------------------------

// Première utilisation : la copie initiale (fichier livré avec l'application) remplit la table
async function amorcer() {
  const sql = await base();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM medicaments_ma`;
  if (n > 0) return;
  await sql`
    INSERT INTO medicaments_ma (url, nom, dci, classe, labo, presentation, dosage, ppv, statut, tableau, generique, fiche_le)
    SELECT m.url, m.nom, m.dci, m.classe, m.labo, m.presentation, m.dosage, m.ppv, m.statut, m.tableau,
           m.generique, now()
    FROM jsonb_to_recordset(${JSON.stringify(medicamentsInitiaux)}::jsonb)
      AS m(url text, nom text, dci text, classe text, labo text, presentation text, dosage text, ppv text,
           statut text, tableau text, generique boolean)
    ON CONFLICT (url) DO NOTHING`;
}

// --- Vérification ---------------------------------------------------------------------------------------------

type BilanLettre = { lues: number; statut: "ok" | "doute" | "erreur"; raison: string };

// Relit toutes les pages d'une lettre ; renvoie les lignes et l'éventuel problème rencontré
async function lireLettre(lettre: string): Promise<{ lignes: LigneListe[]; probleme: string | null; erreur: boolean }> {
  const lignes: LigneListe[] = [];
  for (let page = 1; page <= PAGES_MAX; page++) {
    const l = await lire(adresseListe(lettre, page));
    if ("erreur" in l) return { lignes, probleme: `page ${page} : ${l.erreur}`, erreur: true };
    const lues = lireListe(l.html);
    if (lues === null) return { lignes, probleme: `page ${page} : structure inattendue (le site a peut-être changé)`, erreur: false };
    if (!lues.length) break;
    lignes.push(...lues);
  }
  return { lignes, probleme: null, erreur: false };
}

async function appliquerLettre(lettre: string, lignes: LigneListe[]) {
  const sql = await base();
  const existants = await sql`
    SELECT url, nom, presentation, ppv, labo, retire_le FROM medicaments_ma
    WHERE url = ANY(${lignes.map((l) => l.url)}::text[])`;
  const parUrl = new Map(existants.map((e) => [e.url as string, e]));
  const nouveaux: LigneListe[] = [];
  for (const l of lignes) {
    const e = parUrl.get(l.url);
    if (!e) {
      nouveaux.push(l);
      continue;
    }
    if (e.retire_le) {
      await sql`UPDATE medicaments_ma SET retire_le = NULL WHERE url = ${l.url}`;
      await noter("ajout", l.url, l.nom, "Réapparu dans la liste du site");
    }
    const diffs = differences(
      { nom: e.nom as string, presentation: e.presentation as string, ppv: e.ppv as string, labo: e.labo as string },
      { nom: l.nom, presentation: l.presentation, ppv: l.ppv, labo: l.labo },
    );
    if (diffs.length) {
      await sql`
        UPDATE medicaments_ma SET nom = ${l.nom}, presentation = ${l.presentation}, ppv = ${l.ppv || (e.ppv as string)},
          labo = ${l.labo || (e.labo as string)}, fiche_le = NULL WHERE url = ${l.url}`;
      await noter("modification", l.url, l.nom, diffs.join(" ; "));
    }
  }
  if (nouveaux.length) {
    await sql`
      INSERT INTO medicaments_ma (url, nom, presentation, ppv, labo)
      SELECT m.url, m.nom, m.presentation, m.ppv, m.labo
      FROM jsonb_to_recordset(${JSON.stringify(nouveaux)}::jsonb) AS m(url text, nom text, presentation text, ppv text, labo text)
      ON CONFLICT (url) DO NOTHING`;
    for (const n of nouveaux) await noter("ajout", n.url, n.nom, [n.presentation, n.labo].filter(Boolean).join(" · "));
  }
  await sql`UPDATE medicaments_ma SET vu_le = now(), lettre = ${lettre} WHERE url = ANY(${lignes.map((l) => l.url)}::text[])`;
}

// Complète les détails (substance, classe…) des médicaments nouveaux ou modifiés, quelques-uns par passage
async function completerFiches(limite: number) {
  const sql = await base();
  const aFaire = await sql`SELECT url, nom FROM medicaments_ma WHERE fiche_le IS NULL AND retire_le IS NULL LIMIT ${limite}`;
  for (const l of aFaire) await relireFiche(l.url as string, l.nom as string, false);
}

// Relit une fiche : met à jour la copie, signale les changements ; sur une fiche prescrite, tout écart compte
async function relireFiche(url: string, nom: string, signalerEcarts: boolean) {
  const sql = await base();
  const l = await lire(url);
  if ("erreur" in l) {
    await noter("inaccessible", url, nom, `Fiche inaccessible : ${l.erreur}`);
    return;
  }
  const f = lireFiche(l.html);
  if (f === "introuvable") {
    await sql`UPDATE medicaments_ma SET retire_le = COALESCE(retire_le, now()), fiche_le = now() WHERE url = ${url}`;
    await noter("retrait", url, nom, "La fiche n'existe plus sur le site (« médicament non trouvé »)");
    return;
  }
  if (!f) {
    await noter("doute", url, nom, "La fiche répond mais sa structure est inattendue : lecture impossible, site peut-être modifié");
    return;
  }
  const [avant] = await sql`SELECT * FROM medicaments_ma WHERE url = ${url}`;
  if (avant && signalerEcarts) {
    const diffs = differences(avant as never, f as Partial<Fiche>);
    if (diffs.length) await noter("modification", url, f.nom, diffs.join(" ; "));
  }
  await sql`
    UPDATE medicaments_ma SET nom = ${f.nom}, dci = ${f.dci}, classe = ${f.classe}, labo = ${f.labo || ""},
      presentation = ${f.presentation}, dosage = ${f.dosage}, ppv = ${f.ppv}, statut = ${f.statut},
      tableau = ${f.tableau}, generique = ${f.generique}, fiche_le = now(), retire_le = NULL
    WHERE url = ${url}`;
}

// Médicaments prescrits (ordonnances) ou pris (traitements en cours) : leur fiche est relue à chaque vérification
export async function medicamentsPrescrits(): Promise<{ url: string; nom: string }[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT m.url, m.nom FROM medicaments_ma m
    WHERE m.retire_le IS NULL AND (
      EXISTS (SELECT 1 FROM ordonnances o, jsonb_array_elements(o.lignes) l
              WHERE l->>'fiche' = m.url OR lower(l->>'medicament') = lower(m.nom))
      OR EXISTS (SELECT 1 FROM traitements t WHERE t.fin IS NULL AND lower(t.medicament) = lower(m.nom)))
    LIMIT 150`;
  return lignes.map((l) => ({ url: l.url as string, nom: l.nom as string }));
}

export async function etatVeille(): Promise<EtatVeille> {
  const sql = await base();
  await amorcer();
  const [v] = await sql`SELECT cycle_debut, termine_le, bilan FROM medicaments_veille WHERE id = 1`;
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM medicaments_ma WHERE retire_le IS NULL`;
  const bilan = (v.bilan ?? {}) as Record<string, BilanLettre>;
  const enCours = Boolean(v.cycle_debut) && (!v.termine_le || v.termine_le < v.cycle_debut);
  return { termineLe: v.termine_le as Date | null, enCours, lettresFaites: Object.keys(bilan).length, total: n as number };
}

export async function verificationNecessaire() {
  const e = await etatVeille();
  return e.enCours || !e.termineLe || Date.now() - e.termineLe.getTime() > DELAI_VERIFICATION;
}

// Une passe de vérification, limitée dans le temps ; reprend où la précédente s'est arrêtée
export async function verifierMedicaments(budgetMs = 45_000): Promise<{ terminee: boolean; lettresFaites: number }> {
  const debut = Date.now();
  const sql = await base();
  await amorcer();
  let [v] = await sql`SELECT cycle_debut, termine_le, bilan FROM medicaments_veille WHERE id = 1`;
  const enCours = Boolean(v.cycle_debut) && (!v.termine_le || v.termine_le < v.cycle_debut);
  if (!enCours) {
    await sql`UPDATE medicaments_veille SET cycle_debut = now(), bilan = '{}'::jsonb WHERE id = 1`;
    [v] = await sql`SELECT cycle_debut, termine_le, bilan FROM medicaments_veille WHERE id = 1`;
  }
  const bilan = (v.bilan ?? {}) as Record<string, BilanLettre>;
  const restantes = LETTRES.filter((l) => !(l in bilan));

  const travailleur = async () => {
    while (restantes.length && Date.now() - debut < budgetMs) {
      const lettre = restantes.shift()!;
      const { lignes, probleme, erreur } = await lireLettre(lettre);
      const [{ connus }] = await sql`SELECT count(*)::int AS connus FROM medicaments_ma WHERE lettre = ${lettre} AND retire_le IS NULL`;
      let statut: BilanLettre["statut"] = erreur ? "erreur" : "ok";
      let raison = probleme ?? "";
      if (!probleme) {
        const suspect = lectureSuspecte(connus as number, lignes.length);
        if (suspect) {
          statut = "doute";
          raison = suspect;
        }
      } else if (!erreur) statut = "doute";
      if (statut === "ok" || (statut === "doute" && lignes.length)) await appliquerLettre(lettre, lignes);
      if (statut !== "ok") {
        await noter(statut === "erreur" ? "inaccessible" : "doute", adresseListe(lettre, 1), `Liste du site, lettre ${lettre}`, raison);
      }
      await sql`
        UPDATE medicaments_veille SET bilan = bilan || ${JSON.stringify({ [lettre]: { lues: lignes.length, statut, raison } })}::jsonb
        WHERE id = 1`;
    }
  };
  await Promise.all(Array.from({ length: PARALLELE }, travailleur));

  const [apres] = await sql`SELECT bilan FROM medicaments_veille WHERE id = 1`;
  const faites = (apres.bilan ?? {}) as Record<string, BilanLettre>;
  const lettresFaites = Object.keys(faites).length;
  if (lettresFaites < LETTRES.length) return { terminee: false, lettresFaites };

  await conclure(faites);
  return { terminee: true, lettresFaites };
}

// Fin d'un cycle : retraits confirmés sur la fiche, fiches prescrites relues, détails des nouveautés complétés
async function conclure(bilan: Record<string, BilanLettre>) {
  const sql = await base();
  const tout = Object.values(bilan).every((b) => b.statut === "ok");
  const lettresSures = Object.entries(bilan).filter(([, b]) => b.statut === "ok").map(([l]) => l);
  const absents = await sql`
    SELECT url, nom FROM medicaments_ma
    WHERE retire_le IS NULL AND (vu_le IS NULL OR vu_le < (SELECT cycle_debut FROM medicaments_veille WHERE id = 1))
      AND (${tout} OR lettre = ANY(${lettresSures}::text[]))`;
  const [{ total }] = await sql`SELECT count(*)::int AS total FROM medicaments_ma WHERE retire_le IS NULL`;
  if (absents.length > Math.max(20, (total as number) * 0.05)) {
    await noter(
      "doute",
      "https://medicament.ma/listing-des-medicaments/",
      "Liste du site",
      `${absents.length} médicaments ont disparu de la liste d'un coup : aucun n'a été retiré, à vérifier sur le site`,
    );
  } else {
    for (const a of absents) {
      const l = await lire(a.url as string);
      if ("erreur" in l) {
        await noter("inaccessible", a.url as string, a.nom as string, `Absent de la liste et fiche inaccessible : ${l.erreur}`);
        continue;
      }
      const f = lireFiche(l.html);
      if (f === "introuvable") {
        await sql`UPDATE medicaments_ma SET retire_le = now() WHERE url = ${a.url}`;
        await noter("retrait", a.url as string, a.nom as string, "Retiré du site : absent de la liste, fiche « médicament non trouvé »");
      } else {
        await noter("doute", a.url as string, a.nom as string, "Absent de la liste du site mais sa fiche répond encore : conservé");
      }
    }
  }
  for (const p of await medicamentsPrescrits()) await relireFiche(p.url, p.nom, true);
  await completerFiches(40);
  await sql`UPDATE medicaments_veille SET termine_le = now() WHERE id = 1`;
}

// --- Alertes et patients concernés ------------------------------------------------------------------------------

const PATIENTS_CONCERNES = `
  SELECT DISTINCT p.id, p.nom, p.prenom, o.date::text AS date
  FROM ordonnances o
  JOIN patients p ON p.id = o.patient_id
  CROSS JOIN LATERAL jsonb_array_elements(o.lignes) l`;

export type PatientConcerne = { id: number; nom: string; prenom: string; date: string; origine: "ordonnance" | "traitement" };

// Patients à qui le médicament a été prescrit (ordonnance) ou qui le prennent (traitement en cours)
export async function patientsConcernes(url: string, nom: string): Promise<PatientConcerne[]> {
  const sql = await base();
  const ordonnances = await sql.query(
    `${PATIENTS_CONCERNES} WHERE l->>'fiche' = $1 OR lower(l->>'medicament') = lower($2) ORDER BY date DESC LIMIT 200`,
    [url, nom],
  );
  const traitements = await sql`
    SELECT p.id, p.nom, p.prenom, coalesce(t.debut::text, '') AS date
    FROM traitements t JOIN patients p ON p.id = t.patient_id
    WHERE t.fin IS NULL AND lower(t.medicament) = lower(${nom}) LIMIT 200`;
  return [
    ...ordonnances.map((p) => ({ id: p.id as number, nom: p.nom as string, prenom: p.prenom as string, date: p.date as string, origine: "ordonnance" as const })),
    ...traitements.map((p) => ({ id: p.id as number, nom: p.nom as string, prenom: p.prenom as string, date: p.date as string, origine: "traitement" as const })),
  ];
}

// Changements pas encore traités, avec le nombre de patients touchés ; les médicaments prescrits d'abord
export async function changementsOuverts(limite = 200): Promise<Changement[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT c.id, c.url, c.nom, c.type, c.detail, c.detecte_le,
      (SELECT count(DISTINCT x.patient_id)::int FROM (
         SELECT o.patient_id FROM ordonnances o, jsonb_array_elements(o.lignes) l
           WHERE l->>'fiche' = c.url OR lower(l->>'medicament') = lower(c.nom)
         UNION ALL
         SELECT t.patient_id FROM traitements t WHERE t.fin IS NULL AND lower(t.medicament) = lower(c.nom)) x) AS patients
    FROM medicaments_changements c
    WHERE c.traite_le IS NULL
    ORDER BY patients DESC, c.detecte_le DESC
    LIMIT ${limite}`;
  return lignes.map((l) => ({
    id: l.id as number,
    url: l.url as string,
    nom: l.nom as string,
    type: l.type as TypeChangement,
    detail: l.detail as string,
    detecteLe: l.detecte_le as Date,
    patients: l.patients as number,
  }));
}

export async function compterAlertesPrescrits() {
  return (await changementsOuverts(500)).filter((c) => c.patients > 0 && c.type !== "ajout").length;
}

export async function marquerTraite(id: number, par: string) {
  const sql = await base();
  await sql`UPDATE medicaments_changements SET traite_le = now(), traite_par = ${par} WHERE id = ${id} AND traite_le IS NULL`;
}

export async function marquerTousTraites(par: string, types: TypeChangement[]) {
  const sql = await base();
  await sql`
    UPDATE medicaments_changements SET traite_le = now(), traite_par = ${par}
    WHERE traite_le IS NULL AND type = ANY(${types}::text[])`;
}

export async function bilanVeille() {
  const sql = await base();
  const [v] = await sql`SELECT bilan FROM medicaments_veille WHERE id = 1`;
  return Object.entries((v.bilan ?? {}) as Record<string, BilanLettre>)
    .filter(([, b]) => b.statut !== "ok")
    .map(([lettre, b]) => ({ lettre, ...b }));
}

// Médicaments de la copie, pour la recherche (sans les retirés)
export async function listerMedicaments() {
  const sql = await base();
  await amorcer();
  const lignes = await sql`
    SELECT url, nom, dci, classe, labo, presentation, dosage, ppv, statut, tableau, generique
    FROM medicaments_ma WHERE retire_le IS NULL ORDER BY nom`;
  return lignes as unknown as import("./medicaments-ma").MedicamentMa[];
}

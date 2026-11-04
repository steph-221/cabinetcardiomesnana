// Statistiques de la comptabilité : consultations, chiffre d'affaires et actes, par période et par médecin.
// Mêmes règles que le tableau de bord :
//  - l'encaissé compte à la DATE DU PAIEMENT ;
//  - les consultations, le facturé et les actes comptent à la DATE DE LA FACTURE ;
//  - une facture annulée n'est jamais comptée.
// Montants en centimes.

import { base } from "./base";
import { listerPraticiens, type Praticien } from "./compta";
import {
  granulariteEffective,
  matrice,
  periodePrecedente,
  seaux,
  seauxJoursSemaine,
  type Granularite,
  type Seau,
} from "./compta-stats-calculs";

const n = (v: unknown) => Number(v ?? 0);

// Valeurs fixes (jamais une saisie) : date_trunc ne reçoit que l'une de ces trois unités
const UNITE: Record<Granularite, string> = { jour: "day", semaine: "week", mois: "month" };

export type FiltresStats = {
  du: string | null; // null = depuis la première facture
  au: string;
  praticienId: number | null; // null = tous les médecins
  regroupement: Granularite | null; // null = automatique selon la durée
};

export type Totaux = {
  consultations: number; // factures non annulées, gratuites comprises
  gratuites: number;
  joursActifs: number; // jours où au moins une facture a été faite
  factureCts: number;
  encaisseCts: number;
};

export type LigneActe = {
  libelle: string;
  quantite: number;
  totalCts: number; // montant des lignes de facture, avant remise
  parSeau: number[]; // quantité dans chaque seau de la période
};

export type Statistiques = {
  du: string;
  au: string;
  regroupement: Granularite;
  seaux: Seau[];
  praticiens: Praticien[]; // tous, par identifiant : l'ordre fixe donne à chacun sa couleur
  consultations: number[][]; // [seau][médecin]
  encaisse: number[][]; // [seau][médecin], en centimes
  joursSemaine: number[][]; // [lundi…dimanche][médecin]
  parMedecin: Map<number, { consultations: number; gratuites: number; factureCts: number; encaisseCts: number }>;
  actes: LigneActe[];
  modes: { mode: string; nombre: number; totalCts: number }[];
  assureurs: { nom: string; nombre: number; totalCts: number }[];
  courant: Totaux;
  precedent: { du: string; au: string; totaux: Totaux } | null;
};

async function totaux(du: string, au: string, praticienId: number | null): Promise<Totaux> {
  const sql = await base();
  const [factures, paiements] = await Promise.all([
    sql`SELECT COUNT(*) AS nombre, COUNT(*) FILTER (WHERE f.total_cts = 0) AS gratuites,
               COUNT(DISTINCT f.date) AS jours, COALESCE(SUM(f.total_cts), 0) AS facture
        FROM factures f
        WHERE f.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL
          AND (${praticienId}::int IS NULL OR f.praticien_id = ${praticienId})`,
    sql`SELECT COALESCE(SUM(p.montant_cts), 0) AS encaisse
        FROM paiements p JOIN factures f ON f.id = p.facture_id
        WHERE p.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL
          AND (${praticienId}::int IS NULL OR f.praticien_id = ${praticienId})`,
  ]);
  return {
    consultations: n(factures[0].nombre),
    gratuites: n(factures[0].gratuites),
    joursActifs: n(factures[0].jours),
    factureCts: n(factures[0].facture),
    encaisseCts: n(paiements[0].encaisse),
  };
}

export async function statistiques(filtres: FiltresStats): Promise<Statistiques> {
  const sql = await base();
  const { au, praticienId } = filtres;

  // Première facture : « Tout » commence là, et on ne compare qu'avec une période qui ne la précède pas
  const [premiere] = await sql`SELECT MIN(date) AS d FROM factures WHERE annulee_le IS NULL`;
  const premiereFacture = (premiere.d as string | null) ?? null;
  let du = filtres.du ?? premiereFacture ?? au;
  if (du > au) du = au;

  const regroupement = granulariteEffective(filtres.regroupement, du, au);
  const unite = UNITE[regroupement];
  const liste = seaux(du, au, regroupement);
  const avant = periodePrecedente(du, au);

  const [praticiens, factures, paiements, lignes, reglements, jours, courant, precedent] = await Promise.all([
    listerPraticiens(),
    sql`SELECT date_trunc(${unite}, f.date::timestamp)::date AS cle, f.praticien_id,
               COUNT(*) AS nombre, COUNT(*) FILTER (WHERE f.total_cts = 0) AS gratuites, SUM(f.total_cts) AS facture
        FROM factures f
        WHERE f.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL
          AND (${praticienId}::int IS NULL OR f.praticien_id = ${praticienId})
        GROUP BY 1, 2`,
    sql`SELECT date_trunc(${unite}, p.date::timestamp)::date AS cle, f.praticien_id, SUM(p.montant_cts) AS encaisse
        FROM paiements p JOIN factures f ON f.id = p.facture_id
        WHERE p.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL
          AND (${praticienId}::int IS NULL OR f.praticien_id = ${praticienId})
        GROUP BY 1, 2`,
    sql`SELECT l ->> 'libelle' AS libelle, date_trunc(${unite}, f.date::timestamp)::date AS cle,
               SUM((l ->> 'quantite')::numeric) AS quantite,
               SUM((l ->> 'quantite')::numeric * (l ->> 'prix_cts')::numeric) AS total
        FROM factures f CROSS JOIN LATERAL jsonb_array_elements(f.lignes) AS l
        WHERE f.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL
          AND (${praticienId}::int IS NULL OR f.praticien_id = ${praticienId})
        GROUP BY 1, 2`,
    sql`SELECT p.mode, upper(btrim(p.reference)) AS assureur, COUNT(*) AS nombre, SUM(p.montant_cts) AS total
        FROM paiements p JOIN factures f ON f.id = p.facture_id
        WHERE p.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL
          AND (${praticienId}::int IS NULL OR f.praticien_id = ${praticienId})
        GROUP BY 1, 2`,
    sql`SELECT extract(isodow FROM f.date)::int AS jour, f.praticien_id, COUNT(*) AS nombre
        FROM factures f
        WHERE f.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL
          AND (${praticienId}::int IS NULL OR f.praticien_id = ${praticienId})
        GROUP BY 1, 2`,
    totaux(du, au, praticienId),
    totaux(avant.du, avant.au, praticienId),
  ]);

  const ordre = [...praticiens].sort((a, b) => a.id - b.id);
  const cles = ordre.map((p) => String(p.id));

  const consultations = matrice(liste, cles, factures.map((l) => ({ cle: l.cle as string, serie: String(l.praticien_id), valeur: n(l.nombre) })));
  const encaisse = matrice(liste, cles, paiements.map((l) => ({ cle: l.cle as string, serie: String(l.praticien_id), valeur: n(l.encaisse) })));
  const joursSemaine = matrice(seauxJoursSemaine, cles, jours.map((l) => ({ cle: String(l.jour), serie: String(l.praticien_id), valeur: n(l.nombre) })));

  const parMedecin = new Map<number, { consultations: number; gratuites: number; factureCts: number; encaisseCts: number }>();
  const fiche = (id: number) => {
    let f = parMedecin.get(id);
    if (!f) parMedecin.set(id, (f = { consultations: 0, gratuites: 0, factureCts: 0, encaisseCts: 0 }));
    return f;
  };
  for (const l of factures) {
    const f = fiche(l.praticien_id as number);
    f.consultations += n(l.nombre);
    f.gratuites += n(l.gratuites);
    f.factureCts += n(l.facture);
  }
  for (const l of paiements) fiche(l.praticien_id as number).encaisseCts += n(l.encaisse);

  // Actes : une ligne par intitulé, avec sa quantité dans chaque seau
  const indiceSeau = new Map(liste.map((s, i) => [s.cle, i]));
  const actes = new Map<string, LigneActe>();
  for (const l of lignes) {
    const libelle = (l.libelle as string | null) ?? "(sans intitulé)";
    let a = actes.get(libelle);
    if (!a) actes.set(libelle, (a = { libelle, quantite: 0, totalCts: 0, parSeau: liste.map(() => 0) }));
    const q = n(l.quantite);
    a.quantite += q;
    a.totalCts += n(l.total);
    const i = indiceSeau.get(l.cle as string);
    if (i !== undefined) a.parSeau[i] += q;
  }

  const modes = new Map<string, { mode: string; nombre: number; totalCts: number }>();
  const assureurs = new Map<string, { nom: string; nombre: number; totalCts: number }>();
  for (const l of reglements) {
    const m = modes.get(l.mode as string) ?? { mode: l.mode as string, nombre: 0, totalCts: 0 };
    m.nombre += n(l.nombre);
    m.totalCts += n(l.total);
    modes.set(l.mode as string, m);
    if (l.mode === "mutuelle") {
      const nom = (l.assureur as string) || "Non précisé";
      const a = assureurs.get(nom) ?? { nom, nombre: 0, totalCts: 0 };
      a.nombre += n(l.nombre);
      a.totalCts += n(l.total);
      assureurs.set(nom, a);
    }
  }

  return {
    du,
    au,
    regroupement,
    seaux: liste,
    praticiens: ordre,
    consultations,
    encaisse,
    joursSemaine,
    parMedecin,
    actes: [...actes.values()].sort((a, b) => b.quantite - a.quantite || a.libelle.localeCompare(b.libelle, "fr")),
    modes: [...modes.values()].sort((a, b) => b.totalCts - a.totalCts),
    assureurs: [...assureurs.values()].sort((a, b) => b.totalCts - a.totalCts),
    courant,
    // Pas de comparaison quand la période précédente commence avant la première facture : elle serait incomplète
    // et donnerait des variations absurdes (+40 000 %).
    precedent: premiereFacture !== null && avant.du >= premiereFacture ? { ...avant, totaux: precedent } : null,
  };
}

// Comptabilité du cabinet : médecins associés, tarifs, factures, paiements, charges et bilans.
// Montants en centimes. Les honoraires sont comptés à l'ENCAISSEMENT (date du paiement), comme pour un cabinet libéral ;
// le « facturé » et les impayés sont donnés à côté.

import { cabinet } from "../cabinet";
import { base } from "./base";
import {
  statutFacture,
  type LigneFacture,
  type ModePaiement,
  type StatutFacture,
} from "./compta-calculs";
import { lireParametre, ecrireParametre } from "./parametres";

const n = (v: unknown) => Number(v ?? 0);

// --- Médecins associés ---

export type Praticien = { id: number; nom: string; compte: string | null; part: number; actif: boolean };

const versPraticien = (l: Record<string, unknown>): Praticien => ({
  id: l.id as number,
  nom: l.nom as string,
  compte: (l.compte as string | null) ?? null,
  part: l.part as number,
  actif: l.actif as boolean,
});

// Le premier médecin (celui du site) est créé automatiquement ; le second s'ajoute dans Réglages
export async function listerPraticiens(): Promise<Praticien[]> {
  const sql = await base();
  let lignes = await sql`SELECT * FROM praticiens ORDER BY actif DESC, id`;
  if (lignes.length === 0) {
    await sql`INSERT INTO praticiens (nom, part) SELECT ${cabinet.medecin}, 50 WHERE NOT EXISTS (SELECT 1 FROM praticiens)`;
    lignes = await sql`SELECT * FROM praticiens ORDER BY actif DESC, id`;
  }
  return lignes.map(versPraticien);
}

export async function enregistrerPraticien(
  p: { id: number | null; nom: string; compte: string | null; part: number; actif: boolean },
) {
  const sql = await base();
  if (p.id === null) {
    await sql`INSERT INTO praticiens (nom, compte, part, actif) VALUES (${p.nom}, ${p.compte}, ${p.part}, ${p.actif})`;
  } else {
    await sql`UPDATE praticiens SET nom = ${p.nom}, compte = ${p.compte}, part = ${p.part}, actif = ${p.actif} WHERE id = ${p.id}`;
  }
}

const CLE_MISE_EN_COMMUN = "compta.mise_en_commun";
export async function miseEnCommun() {
  return (await lireParametre(CLE_MISE_EN_COMMUN)) === "1";
}
export async function reglerMiseEnCommun(actif: boolean) {
  await ecrireParametre(CLE_MISE_EN_COMMUN, actif ? "1" : null);
}

// --- Tarifs ---

export type Acte = { id: number; libelle: string; tarifCts: number; archive: boolean };

// Tous les actes, archivés compris (Réglages). Les factures ne proposent que les actes non archivés.
export async function listerActes(): Promise<Acte[]> {
  const sql = await base();
  const lignes = await sql`SELECT id, libelle, tarif_cts, archive FROM actes ORDER BY archive, ordre, id`;
  return lignes.map((l) => ({
    id: l.id as number,
    libelle: l.libelle as string,
    tarifCts: l.tarif_cts as number,
    archive: l.archive as boolean,
  }));
}

// Archiver : l'acte disparaît des raccourcis de facture, les factures déjà faites ne changent pas.
export async function archiverActe(id: number, archive: boolean) {
  const sql = await base();
  await sql`UPDATE actes SET archive = ${archive} WHERE id = ${id}`;
}

export async function enregistrerActe(a: { id: number | null; libelle: string; tarifCts: number }) {
  const sql = await base();
  if (a.id === null) {
    await sql`INSERT INTO actes (libelle, tarif_cts, ordre)
              VALUES (${a.libelle}, ${a.tarifCts}, COALESCE((SELECT MAX(ordre) FROM actes), 0) + 1)`;
  } else {
    await sql`UPDATE actes SET libelle = ${a.libelle}, tarif_cts = ${a.tarifCts} WHERE id = ${a.id}`;
  }
}

export async function supprimerActe(id: number) {
  const sql = await base();
  await sql`DELETE FROM actes WHERE id = ${id}`;
}

// --- Factures et paiements ---

export type Paiement = {
  id: number;
  factureId: number;
  date: string;
  montantCts: number;
  mode: ModePaiement;
  reference: string;
  creePar: string;
};

export type Facture = {
  id: number;
  numero: string;
  date: string;
  patientId: number | null;
  patientNom: string;
  praticienId: number;
  praticienNom: string;
  lignes: LigneFacture[];
  remiseCts: number;
  totalCts: number;
  payeCts: number;
  note: string;
  annulee: boolean;
  motifAnnulation: string;
  statut: StatutFacture;
  creePar: string;
};

const versFacture = (l: Record<string, unknown>): Facture => {
  const annulee = l.annulee_le !== null && l.annulee_le !== undefined;
  const totalCts = l.total_cts as number;
  const payeCts = n(l.paye_cts);
  const brutes = l.lignes as { libelle: string; quantite: number; prix_cts: number }[];
  return {
    id: l.id as number,
    numero: l.numero as string,
    date: l.date as string,
    patientId: (l.patient_id as number | null) ?? null,
    patientNom: l.patient_nom as string,
    praticienId: l.praticien_id as number,
    praticienNom: (l.praticien_nom as string) ?? "",
    lignes: brutes.map((b) => ({ libelle: b.libelle, quantite: b.quantite, prixCts: b.prix_cts })),
    remiseCts: l.remise_cts as number,
    totalCts,
    payeCts,
    note: l.note as string,
    annulee,
    motifAnnulation: l.motif_annulation as string,
    statut: statutFacture({ annulee, totalCts, payeCts }),
    creePar: l.cree_par as string,
  };
};

const versPaiement = (l: Record<string, unknown>): Paiement => ({
  id: l.id as number,
  factureId: l.facture_id as number,
  date: l.date as string,
  montantCts: l.montant_cts as number,
  mode: l.mode as ModePaiement,
  reference: l.reference as string,
  creePar: l.cree_par as string,
});

// Crée la facture avec le prochain numéro du mois (2026-11-0001…) et, si demandé, son premier paiement.
// Le compteur est incrémenté dans la même requête : deux factures simultanées n'ont jamais le même numéro.
export async function creerFacture(
  f: {
    date: string;
    patientId: number | null;
    patientNom: string;
    praticienId: number;
    lignes: LigneFacture[];
    remiseCts: number;
    totalCts: number;
    note: string;
  },
  paiement: { montantCts: number; mode: ModePaiement; reference: string } | null,
  par: string,
) {
  const sql = await base();
  const mois = f.date.slice(0, 7); // AAAA-MM : la numérotation repart à 0001 chaque mois
  const lignes = JSON.stringify(f.lignes.map((l) => ({ libelle: l.libelle, quantite: l.quantite, prix_cts: l.prixCts })));
  const paye = paiement && paiement.montantCts > 0 ? paiement : null;
  // Une seule requête : la facture et son premier paiement sont enregistrés ensemble ou pas du tout
  const [facture] = await sql`
    WITH compteur AS (
      INSERT INTO compteurs_factures_mois (mois, dernier) VALUES (${mois}, 1)
      ON CONFLICT (mois) DO UPDATE SET dernier = compteurs_factures_mois.dernier + 1
      RETURNING dernier
    ), nouvelle AS (
      INSERT INTO factures (numero, date, patient_id, patient_nom, praticien_id, lignes, remise_cts, total_cts, note, cree_par)
      SELECT ${mois} || '-' || lpad(compteur.dernier::text, 4, '0'), ${f.date}, ${f.patientId}, ${f.patientNom},
             ${f.praticienId}, ${lignes}::jsonb, ${f.remiseCts}, ${f.totalCts}, ${f.note}, ${par}
      FROM compteur
      RETURNING id, numero
    ), reglement AS (
      INSERT INTO paiements (facture_id, date, montant_cts, mode, reference, cree_par)
      SELECT nouvelle.id, ${f.date}, ${paye?.montantCts ?? 0}, ${paye?.mode ?? "especes"}, ${paye?.reference ?? ""}, ${par}
      FROM nouvelle WHERE ${paye !== null}
    )
    SELECT id, numero FROM nouvelle`;
  return { id: facture.id as number, numero: facture.numero as string };
}

const SELECT_FACTURE = `
  SELECT f.*, pr.nom AS praticien_nom,
         COALESCE((SELECT SUM(p.montant_cts) FROM paiements p WHERE p.facture_id = f.id), 0) AS paye_cts
  FROM factures f JOIN praticiens pr ON pr.id = f.praticien_id`;

export async function lireFacture(id: number) {
  const sql = await base();
  const [ligne] = await sql.query(`${SELECT_FACTURE} WHERE f.id = $1`, [id]);
  if (!ligne) return null;
  const paiements = await sql`SELECT * FROM paiements WHERE facture_id = ${id} ORDER BY date, id`;
  return { facture: versFacture(ligne), paiements: paiements.map(versPaiement) };
}

export type FiltreFactures = {
  du?: string;
  au?: string;
  recherche?: string;
  statut?: StatutFacture;
  patientId?: number;
  limite?: number;
};

export async function listerFactures(filtre: FiltreFactures = {}) {
  const sql = await base();
  const conditions: string[] = [];
  const valeurs: unknown[] = [];
  const ajouter = (condition: string, valeur: unknown) => {
    valeurs.push(valeur);
    conditions.push(condition.replaceAll("?", `$${valeurs.length}`));
  };
  if (filtre.du) ajouter("f.date >= ?", filtre.du);
  if (filtre.au) ajouter("f.date <= ?", filtre.au);
  if (filtre.patientId) ajouter("f.patient_id = ?", filtre.patientId);
  if (filtre.recherche) ajouter("(f.numero ILIKE ? OR unaccent(f.patient_nom) ILIKE unaccent(?))", `%${filtre.recherche.replace(/[\\%_]/g, "\\$&")}%`);
  // Le statut se déduit des paiements : filtré après le calcul des sommes
  const lignes = await sql.query(
    `SELECT * FROM (${SELECT_FACTURE}) f ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     ORDER BY f.date DESC, f.id DESC LIMIT ${Math.min(filtre.limite ?? 300, 1000)}`,
    valeurs,
  );
  const factures = lignes.map(versFacture);
  return filtre.statut ? factures.filter((f) => f.statut === filtre.statut) : factures;
}

export async function annulerFacture(id: number, motif: string, par: string) {
  const sql = await base();
  await sql`UPDATE factures SET annulee_le = now(), annulee_par = ${par}, motif_annulation = ${motif}
            WHERE id = ${id} AND annulee_le IS NULL`;
}

export async function ajouterPaiement(
  factureId: number,
  p: { date: string; montantCts: number; mode: ModePaiement; reference: string },
  par: string,
) {
  const sql = await base();
  await sql`INSERT INTO paiements (facture_id, date, montant_cts, mode, reference, cree_par)
            VALUES (${factureId}, ${p.date}, ${p.montantCts}, ${p.mode}, ${p.reference}, ${par})`;
}

export async function supprimerPaiement(factureId: number, id: number) {
  const sql = await base();
  const [ligne] = await sql`DELETE FROM paiements WHERE id = ${id} AND facture_id = ${factureId} RETURNING montant_cts`;
  return (ligne?.montant_cts as number | undefined) ?? null;
}

// --- Charges ---

export type Charge = {
  id: number;
  date: string;
  categorie: string;
  libelle: string;
  fournisseur: string;
  montantCts: number;
  mode: ModePaiement;
  praticienId: number | null; // null = charge commune
  praticienNom: string | null;
  automatique: boolean; // créée par une charge récurrente
  creePar: string;
};

export async function creerCharge(
  c: {
    date: string;
    categorie: string;
    libelle: string;
    fournisseur: string;
    montantCts: number;
    mode: ModePaiement;
    praticienId: number | null;
  },
  par: string,
) {
  const sql = await base();
  await sql`INSERT INTO charges (date, categorie, libelle, fournisseur, montant_cts, mode, praticien_id, cree_par)
            VALUES (${c.date}, ${c.categorie}, ${c.libelle}, ${c.fournisseur}, ${c.montantCts}, ${c.mode}, ${c.praticienId}, ${par})`;
}

export async function listerCharges(du: string, au: string): Promise<Charge[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT c.*, pr.nom AS praticien_nom FROM charges c LEFT JOIN praticiens pr ON pr.id = c.praticien_id
    WHERE c.date BETWEEN ${du} AND ${au} ORDER BY c.date DESC, c.id DESC`;
  return lignes.map((l) => ({
    id: l.id as number,
    date: l.date as string,
    categorie: l.categorie as string,
    libelle: l.libelle as string,
    fournisseur: l.fournisseur as string,
    montantCts: l.montant_cts as number,
    mode: l.mode as ModePaiement,
    praticienId: (l.praticien_id as number | null) ?? null,
    praticienNom: (l.praticien_nom as string | null) ?? null,
    automatique: l.recurrente_id !== null && l.recurrente_id !== undefined,
    creePar: l.cree_par as string,
  }));
}

// Supprimer une charge créée par une récurrence : le mois est mémorisé pour ne pas être recréé
export async function supprimerCharge(id: number) {
  const sql = await base();
  const [ligne] = await sql`
    WITH supprimee AS (
      DELETE FROM charges WHERE id = ${id} RETURNING libelle, montant_cts, recurrente_id, mois
    ), memoire AS (
      INSERT INTO charges_recurrentes_sautees (recurrente_id, mois)
      SELECT recurrente_id, mois FROM supprimee WHERE recurrente_id IS NOT NULL AND mois IS NOT NULL
      ON CONFLICT DO NOTHING
    )
    SELECT libelle, montant_cts FROM supprimee`;
  return ligne ? { libelle: ligne.libelle as string, montantCts: ligne.montant_cts as number } : null;
}

// --- Charges récurrentes ---

export type ChargeRecurrente = {
  id: number;
  categorie: string;
  libelle: string;
  fournisseur: string;
  montantCts: number;
  mode: ModePaiement;
  praticienId: number | null;
  praticienNom: string | null;
  jour: number; // jour du mois (le 31 devient le dernier jour des mois plus courts)
  debut: string;
  fin: string | null;
  actif: boolean;
};

export async function listerRecurrentes(): Promise<ChargeRecurrente[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT r.*, pr.nom AS praticien_nom FROM charges_recurrentes r LEFT JOIN praticiens pr ON pr.id = r.praticien_id
    ORDER BY r.actif DESC, r.libelle, r.id`;
  return lignes.map((l) => ({
    id: l.id as number,
    categorie: l.categorie as string,
    libelle: l.libelle as string,
    fournisseur: l.fournisseur as string,
    montantCts: l.montant_cts as number,
    mode: l.mode as ModePaiement,
    praticienId: (l.praticien_id as number | null) ?? null,
    praticienNom: (l.praticien_nom as string | null) ?? null,
    jour: l.jour as number,
    debut: l.debut as string,
    fin: (l.fin as string | null) ?? null,
    actif: l.actif as boolean,
  }));
}

export type SaisieRecurrente = Omit<ChargeRecurrente, "id" | "praticienNom">;

export async function enregistrerRecurrente(id: number | null, c: SaisieRecurrente, par: string) {
  const sql = await base();
  if (id === null) {
    await sql`INSERT INTO charges_recurrentes (categorie, libelle, fournisseur, montant_cts, mode, praticien_id, jour, debut, fin, actif, cree_par)
              VALUES (${c.categorie}, ${c.libelle}, ${c.fournisseur}, ${c.montantCts}, ${c.mode}, ${c.praticienId}, ${c.jour}, ${c.debut}, ${c.fin}, ${c.actif}, ${par})`;
  } else {
    await sql`UPDATE charges_recurrentes SET categorie = ${c.categorie}, libelle = ${c.libelle}, fournisseur = ${c.fournisseur},
                montant_cts = ${c.montantCts}, mode = ${c.mode}, praticien_id = ${c.praticienId}, jour = ${c.jour},
                debut = ${c.debut}, fin = ${c.fin}, actif = ${c.actif} WHERE id = ${id}`;
  }
}

// Les charges déjà créées restent (elles font partie des comptes) ; seule la récurrence disparaît
export async function supprimerRecurrente(id: number) {
  const sql = await base();
  const [ligne] = await sql`DELETE FROM charges_recurrentes WHERE id = ${id} RETURNING libelle`;
  return (ligne?.libelle as string | undefined) ?? null;
}

// Crée les charges récurrentes échues jusqu'à `jour` (AAAA-MM-JJ) qui n'existent pas encore.
// Appelée à l'ouverture des pages de comptabilité : une seule requête, sans effet si tout est à jour,
// et sûre si deux personnes ouvrent la page en même temps (index unique). Rattrape aussi les mois manqués.
export async function genererChargesRecurrentes(jour: string) {
  const sql = await base();
  const creees = await sql`
    INSERT INTO charges (date, categorie, libelle, fournisseur, montant_cts, mode, praticien_id, cree_par, recurrente_id, mois)
    SELECT x.d, r.categorie, r.libelle, r.fournisseur, r.montant_cts, r.mode, r.praticien_id, 'automatique', r.id,
           to_char(x.d, 'YYYY-MM')
    FROM charges_recurrentes r
    CROSS JOIN LATERAL generate_series(
      0,
      (date_part('year', ${jour}::date)::int * 12 + date_part('month', ${jour}::date)::int)
        - (date_part('year', r.debut)::int * 12 + date_part('month', r.debut)::int)
    ) AS n
    CROSS JOIN LATERAL (
      SELECT (date_trunc('month', r.debut)::date + n * interval '1 month')::date AS mois_debut
    ) m
    CROSS JOIN LATERAL (
      SELECT LEAST(m.mois_debut + (r.jour - 1), (m.mois_debut + interval '1 month' - interval '1 day')::date) AS d
    ) x
    WHERE r.actif AND x.d >= r.debut AND x.d <= ${jour}::date AND (r.fin IS NULL OR x.d <= r.fin)
      AND NOT EXISTS (
        SELECT 1 FROM charges_recurrentes_sautees s WHERE s.recurrente_id = r.id AND s.mois = to_char(x.d, 'YYYY-MM')
      )
    ON CONFLICT (recurrente_id, mois) DO NOTHING
    RETURNING id`;
  return creees.length;
}

// --- Bilan d'une période ---

export type Bilan = {
  encaisseParMedecin: Map<number, number>;
  encaisseParMode: Map<string, number>;
  encaisseTotal: number;
  factureTotal: number; // factures émises pendant la période (hors annulées)
  chargesCommunes: number;
  chargesPersoParMedecin: Map<number, number>;
  chargesParCategorie: Map<string, number>;
  chargesTotal: number;
  impayes: { nombre: number; totalCts: number }; // à ce jour, toutes périodes
};

export async function bilan(du: string, au: string): Promise<Bilan> {
  const sql = await base();
  const [paiements, facture, charges, impayes] = await Promise.all([
    sql`SELECT f.praticien_id, p.mode, SUM(p.montant_cts) AS total
        FROM paiements p JOIN factures f ON f.id = p.facture_id
        WHERE p.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL
        GROUP BY f.praticien_id, p.mode`,
    sql`SELECT COALESCE(SUM(total_cts), 0) AS total FROM factures
        WHERE date BETWEEN ${du} AND ${au} AND annulee_le IS NULL`,
    sql`SELECT praticien_id, categorie, SUM(montant_cts) AS total FROM charges
        WHERE date BETWEEN ${du} AND ${au} GROUP BY praticien_id, categorie`,
    sql`SELECT COUNT(*) AS nombre, COALESCE(SUM(reste), 0) AS total FROM (
          SELECT f.total_cts - COALESCE(SUM(p.montant_cts), 0) AS reste
          FROM factures f LEFT JOIN paiements p ON p.facture_id = f.id
          WHERE f.annulee_le IS NULL GROUP BY f.id HAVING f.total_cts > COALESCE(SUM(p.montant_cts), 0)
        ) t`,
  ]);

  const somme = <K>(m: Map<K, number>, cle: K, v: number) => m.set(cle, (m.get(cle) ?? 0) + v);
  const encaisseParMedecin = new Map<number, number>();
  const encaisseParMode = new Map<string, number>();
  let encaisseTotal = 0;
  for (const l of paiements) {
    somme(encaisseParMedecin, l.praticien_id as number, n(l.total));
    somme(encaisseParMode, l.mode as string, n(l.total));
    encaisseTotal += n(l.total);
  }
  const chargesPersoParMedecin = new Map<number, number>();
  const chargesParCategorie = new Map<string, number>();
  let chargesCommunes = 0;
  let chargesTotal = 0;
  for (const l of charges) {
    const v = n(l.total);
    chargesTotal += v;
    somme(chargesParCategorie, l.categorie as string, v);
    if (l.praticien_id === null) chargesCommunes += v;
    else somme(chargesPersoParMedecin, l.praticien_id as number, v);
  }
  return {
    encaisseParMedecin,
    encaisseParMode,
    encaisseTotal,
    factureTotal: n(facture[0].total),
    chargesCommunes,
    chargesPersoParMedecin,
    chargesParCategorie,
    chargesTotal,
    impayes: { nombre: n(impayes[0].nombre), totalCts: n(impayes[0].total) },
  };
}

// Recettes encaissées et charges de chaque mois d'une année (pour le graphique)
export async function serieAnnuelle(annee: number) {
  const sql = await base();
  const du = `${annee}-01-01`;
  const au = `${annee}-12-31`;
  const [recettes, charges] = await Promise.all([
    sql`SELECT to_char(p.date, 'MM') AS mois, SUM(p.montant_cts) AS total
        FROM paiements p JOIN factures f ON f.id = p.facture_id
        WHERE p.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL GROUP BY 1`,
    sql`SELECT to_char(date, 'MM') AS mois, SUM(montant_cts) AS total FROM charges
        WHERE date BETWEEN ${du} AND ${au} GROUP BY 1`,
  ]);
  const mois = Array.from({ length: 12 }, () => ({ recettes: 0, charges: 0 }));
  for (const l of recettes) mois[Number(l.mois) - 1].recettes = n(l.total);
  for (const l of charges) mois[Number(l.mois) - 1].charges = n(l.total);
  return mois;
}

// --- Export pour le comptable ---

export async function paiementsDeLaPeriode(du: string, au: string) {
  const sql = await base();
  const lignes = await sql`
    SELECT p.date, f.numero, f.patient_nom, pr.nom AS praticien, p.mode, p.reference, p.montant_cts
    FROM paiements p JOIN factures f ON f.id = p.facture_id JOIN praticiens pr ON pr.id = f.praticien_id
    WHERE p.date BETWEEN ${du} AND ${au} AND f.annulee_le IS NULL ORDER BY p.date, p.id`;
  return lignes.map((l) => ({
    date: l.date as string,
    numero: l.numero as string,
    patient: l.patient_nom as string,
    praticien: l.praticien as string,
    mode: l.mode as string,
    reference: l.reference as string,
    montantCts: l.montant_cts as number,
  }));
}

// Import du registre Excel des consultations dans la comptabilité (factures + paiements).
//
// Usage :
//   node scripts/import-registre-compta.mjs visites.json              → contrôle seulement, rien n'est écrit
//   DATABASE_URL=… node scripts/import-registre-compta.mjs visites.json --ecrire
//
// visites.json est produit à partir du classeur (voir le rapport joint à l'import). Tout l'import est une seule
// transaction : en cas d'erreur, rien n'est enregistré. Un second --ecrire est refusé si un import a déjà eu lieu.
//
// Ce script fait aussi les deux réglages demandés : création des médecins manquants et tarifs des actes.
// Il crée la table des numéros par mois et la colonne d'archivage si la migration 13 n'a pas encore tourné ;
// l'application les reprendra telles quelles.

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const MODES = ["especes", "cheque", "carte", "virement", "mutuelle"];
const MEDECINS = {
  TAOUAB: { recherche: "%taouab%", creer: null }, // médecin du site, déjà présent dans l'application
  NAJOUA: { recherche: "%najoua%", creer: null }, // second associé, déjà ajouté dans Réglages
  ZAROUF: { recherche: "%zarouf%", creer: "Dr Zarouf" },
  ARCHICH: { recherche: "%archich%", creer: "Dr Archich" },
};
const PART_NOUVEAUX_MEDECINS = 0; // à régler dans Réglages (ils ne portent aucune part des charges communes)
const PAIEMENT_CREE_PAR = "import-registre";

const [, , fichier, ...options] = process.argv;
if (!fichier) {
  console.error("Usage : node scripts/import-registre-compta.mjs visites.json [--ecrire]");
  process.exit(1);
}
const ecrire = options.includes("--ecrire");
const donnees = JSON.parse(readFileSync(fichier, "utf8"));

// ---------- Contrôle des données ----------
const erreurs = [];
const dateValide = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
donnees.factures.forEach((f, i) => {
  const ref = `ligne Excel ${f.ligne ?? i + 1}`;
  if (!dateValide(f.date)) erreurs.push(`${ref} : date invalide (${f.date})`);
  if (!MEDECINS[f.medecin]) erreurs.push(`${ref} : médecin inconnu (${f.medecin})`);
  if (!Number.isInteger(f.totalCts) || f.totalCts < 0) erreurs.push(`${ref} : total invalide`);
  const somme = f.lignes.reduce((s, l) => s + l.prixCts * l.quantite, 0);
  if (somme !== f.totalCts) erreurs.push(`${ref} : les lignes (${somme}) ne font pas le total (${f.totalCts})`);
  if (f.totalCts > 0 && !MODES.includes(f.mode)) erreurs.push(`${ref} : mode de paiement invalide (${f.mode})`);
});
if (erreurs.length) {
  console.error(`${erreurs.length} erreur(s) dans le fichier, rien n'a été écrit :`);
  for (const e of erreurs.slice(0, 50)) console.error("  - " + e);
  process.exit(1);
}

// ---------- Numérotation : AAAA-MM-NNNN, repart à 0001 chaque mois, dans l'ordre des dates ----------
const ordre = donnees.factures
  .map((f, i) => ({ ...f, _i: i }))
  .sort((a, b) => a.date.localeCompare(b.date) || a._i - b._i);

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
if (ecrire && !sql) {
  console.error("DATABASE_URL est nécessaire pour --ecrire.");
  process.exit(1);
}

const mois = [...new Set(ordre.map((f) => f.date.slice(0, 7)))];
const dernierParMois = Object.fromEntries(mois.map((m) => [m, 0]));
if (sql) {
  // Lecture seule : compteur existant de chaque mois (table absente = aucun compteur encore)
  const [{ existe }] = await sql`SELECT to_regclass('compteurs_factures_mois') IS NOT NULL AS existe`;
  if (existe) {
    const compteurs = await sql`SELECT mois, dernier FROM compteurs_factures_mois`;
    for (const c of compteurs) if (c.mois in dernierParMois) dernierParMois[c.mois] = c.dernier;
  }
}
const compteurDepart = { ...dernierParMois };
const numeros = new Map();
for (const f of ordre) {
  const m = f.date.slice(0, 7);
  dernierParMois[m] += 1;
  numeros.set(f._i, `${m}-${String(dernierParMois[m]).padStart(4, "0")}`);
}

// ---------- Rapport ----------
const totalParMedecin = {};
for (const f of donnees.factures) totalParMedecin[f.medecin] = (totalParMedecin[f.medecin] ?? 0) + f.totalCts;
const euros = (cts) => (cts / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
console.log(`Factures à importer : ${donnees.factures.length}`);
console.log(`Paiements : ${donnees.factures.filter((f) => f.totalCts > 0).length} (gratuites : ${donnees.factures.filter((f) => f.totalCts === 0).length})`);
for (const [medecin, total] of Object.entries(totalParMedecin)) console.log(`  ${medecin.padEnd(8)} ${euros(total)} MAD`);
console.log(`  total    ${euros(Object.values(totalParMedecin).reduce((s, v) => s + v, 0))} MAD`);
for (const m of mois) {
  const debut = numeros.get(ordre.find((f) => f.date.startsWith(m))._i);
  const fin = [...numeros].filter(([, n]) => n.startsWith(m)).pop()?.[1];
  console.log(`  ${m} : ${debut} → ${fin}  (compteur existant : ${compteurDepart[m]})`);
}

if (!ecrire) {
  console.log("\nContrôle terminé. Aucune écriture. Relancez avec --ecrire (et DATABASE_URL) pour importer.");
  process.exit(0);
}

// ---------- Écriture (une seule transaction) ----------
const deja = await sql`SELECT count(*)::int AS n FROM factures WHERE cree_par = ${PAIEMENT_CREE_PAR}`;
if (deja[0].n > 0) {
  console.error(`Un import a déjà eu lieu (${deja[0].n} factures). Rien n'a été écrit.`);
  process.exit(1);
}

const requetes = [];

// Migration 13 (idempotente) si elle n'a pas encore tourné
requetes.push(sql.query(`ALTER TABLE actes ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false`));

// Médecins : retrouver ou créer
const praticiens = await sql`SELECT id, nom, actif FROM praticiens`;
const idMedecin = {};
for (const [code, { recherche, creer }] of Object.entries(MEDECINS)) {
  const trouves = praticiens.filter((p) => p.nom.toLowerCase().includes(recherche.slice(1, -1)));
  if (trouves.length === 1) idMedecin[code] = trouves[0].id;
  else if (trouves.length > 1) throw new Error(`Plusieurs médecins correspondent à ${code} : ${trouves.map((p) => p.nom).join(", ")}`);
  else if (creer) {
    const [nouveau] = await sql`INSERT INTO praticiens (nom, part, actif) VALUES (${creer}, ${PART_NOUVEAUX_MEDECINS}, true) RETURNING id`;
    idMedecin[code] = nouveau.id;
    console.log(`Médecin créé : ${creer} (part ${PART_NOUVEAUX_MEDECINS} %)`);
  } else throw new Error(`Médecin ${code} introuvable dans l'application : créez-le dans Réglages puis relancez.`);
}

// Tarifs des actes
const tarifs = await sql`SELECT libelle FROM actes`;
for (const [libelle, tarifCts] of Object.entries(donnees.actes_prix ?? {})) {
  if (!tarifs.some((a) => a.libelle === libelle)) {
    console.warn(`Acte absent, tarif non modifié : ${libelle}`);
    continue;
  }
  requetes.push(sql.query(`UPDATE actes SET tarif_cts = $2 WHERE libelle = $1`, [libelle, tarifCts]));
}

// Factures et paiements
for (const f of ordre) {
  const numero = numeros.get(f._i);
  const lignes = JSON.stringify(f.lignes.map((l) => ({ libelle: l.libelle, quantite: l.quantite, prix_cts: l.prixCts })));
  requetes.push(
    sql.query(
      `INSERT INTO factures (numero, date, patient_id, patient_nom, praticien_id, lignes, remise_cts, total_cts, note, cree_par)
       VALUES ($1, $2, NULL, $3, $4, $5::jsonb, 0, $6, $7, $8)`,
      [numero, f.date, f.nom, idMedecin[f.medecin], lignes, f.totalCts, f.note, PAIEMENT_CREE_PAR],
    ),
  );
  if (f.totalCts > 0) {
    requetes.push(
      sql.query(
        `INSERT INTO paiements (facture_id, date, montant_cts, mode, reference, cree_par)
         SELECT id, $2, $3, $4, $5, $6 FROM factures WHERE numero = $1`,
        [numero, f.date, f.totalCts, f.mode, f.reference ?? "", PAIEMENT_CREE_PAR],
      ),
    );
  }
}

// Compteurs : la suite de l'application repart après le dernier numéro importé
for (const m of mois) {
  requetes.push(
    sql.query(
      `INSERT INTO compteurs_factures_mois (mois, dernier) VALUES ($1, $2)
       ON CONFLICT (mois) DO UPDATE SET dernier = $2`,
      [m, dernierParMois[m]],
    ),
  );
}

await sql.transaction(requetes);
console.log(`Import terminé : ${donnees.factures.length} factures, ${requetes.length} instructions en une transaction.`);

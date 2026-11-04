// Résultats d'analyses reçus par email. Un script Google (voir RESULTATS.md) envoie chaque PDF au site ;
// il est classé tout seul dans le dossier du patient si le nom est sûr, sinon il attend dans « À classer ».
// Le fichier reste ici (base64) tant qu'il n'est pas confirmé, puis il n'existe plus que dans Google Drive.

import { base } from "./base";
import { compteDrive, envoyerExamen, mettreALaCorbeille } from "./drive";
import { ajouterExamen, supprimerExamen } from "./examens";
import { journaliser } from "./journal";
import { lirePatient } from "./patients";
import { patientsCites } from "./rapprochement";

export type Resultat = {
  id: number;
  labo: string;
  expediteur: string;
  sujet: string;
  nomFichier: string;
  date: string;
  taille: number;
  statut: "a_classer" | "a_relire" | "valide" | "ignore";
  patientId: number | null;
  patientNom: string;
  candidats: { id: number; nom: string; prenom: string }[];
  recuLe: Date;
};

export async function recevoirResultat(r: {
  messageId: string;
  nomFichier: string;
  labo: string;
  expediteur: string;
  sujet: string;
  corps: string;
  date: string;
  fichier: File;
}): Promise<{ id: number; statut: Resultat["statut"] } | { doublon: true }> {
  const sql = await base();
  const contenu = Buffer.from(await r.fichier.arrayBuffer()).toString("base64");
  const lignes = await sql`
    INSERT INTO resultats_recus (message_id, nom_fichier, labo, expediteur, sujet, date_resultat, type_fichier, taille, contenu)
    VALUES (${r.messageId}, ${r.nomFichier}, ${r.labo}, ${r.expediteur}, ${r.sujet}, ${r.date}, ${r.fichier.type},
            ${r.fichier.size}, ${contenu})
    ON CONFLICT (message_id, nom_fichier) DO NOTHING RETURNING id`;
  if (!lignes.length) return { doublon: true };
  const id = lignes[0].id as number;

  const patients = (await sql`SELECT id, nom, prenom FROM patients`) as { id: number; nom: string; prenom: string }[];
  const { surs, possibles } = patientsCites(`${r.sujet} ${r.nomFichier} ${r.corps.slice(0, 1500)}`, patients);
  const candidats = [...surs, ...possibles].slice(0, 6);
  if (candidats.length) await sql`UPDATE resultats_recus SET candidats = ${candidats} WHERE id = ${id}`;

  if (surs.length === 1 && (await compteDrive())) {
    try {
      await classerResultat(id, surs[0], `email : ${r.labo}`, "a_relire");
      return { id, statut: "a_relire" };
    } catch (erreur) {
      console.error(erreur); // reste dans « À classer »
    }
  }
  return { id, statut: "a_classer" };
}

// Range le PDF dans le dossier Drive du patient et crée l'examen « Biologie »
export async function classerResultat(id: number, patientId: number, par: string, statut: "a_relire" | "valide") {
  const sql = await base();
  const [r] = await sql`SELECT * FROM resultats_recus WHERE id = ${id} AND statut IN ('a_classer', 'a_relire')`;
  if (!r?.contenu) throw new Error("Résultat introuvable ou déjà traité.");
  const patient = await lirePatient(patientId);
  if (!patient) throw new Error("Dossier introuvable.");

  const fichier = new Blob([Buffer.from(r.contenu as string, "base64")], { type: r.type_fichier as string });
  const drive = await envoyerExamen(patient, `${r.date_resultat} Biologie — ${r.nom_fichier}`, fichier);
  let examen: number;
  try {
    examen = await ajouterExamen(
      patientId,
      {
        type: "Biologie",
        date: r.date_resultat as string,
        conclusion: "",
        fichier: { drive, nom: r.nom_fichier as string, type: r.type_fichier as string, taille: r.taille as number },
      },
      par,
    );
  } catch (erreur) {
    await mettreALaCorbeille(drive).catch(console.error);
    throw erreur;
  }
  await sql`UPDATE resultats_recus SET statut = ${statut}, patient_id = ${patientId}, examen_id = ${examen},
              contenu = ${statut === "valide" ? null : r.contenu}, traite_le = now(), traite_par = ${par} WHERE id = ${id}`;
  await journaliser(par, "résultat reçu par email classé", patientId, `${r.labo} — ${r.nom_fichier}`);
}

export async function confirmerResultat(id: number, par: string) {
  const sql = await base();
  const [r] = await sql`UPDATE resultats_recus SET statut = 'valide', contenu = NULL, traite_le = now(), traite_par = ${par}
                        WHERE id = ${id} AND statut = 'a_relire' RETURNING patient_id`;
  if (r) await journaliser(par, "résultat reçu par email confirmé", r.patient_id as number);
}

// Classé au mauvais endroit : l'examen quitte le dossier et le résultat retourne dans « À classer »
export async function detacherResultat(id: number, par: string) {
  const sql = await base();
  const [r] = await sql`SELECT patient_id, examen_id FROM resultats_recus WHERE id = ${id} AND statut = 'a_relire'`;
  if (!r?.patient_id || !r.examen_id) return;
  const drive = await supprimerExamen(r.patient_id as number, r.examen_id as number);
  if (drive) await mettreALaCorbeille(drive).catch(console.error);
  await sql`UPDATE resultats_recus SET statut = 'a_classer', patient_id = NULL, examen_id = NULL, traite_le = now(),
              traite_par = ${par} WHERE id = ${id}`;
  await journaliser(par, "résultat reçu par email retiré du dossier", r.patient_id as number);
}

export async function ignorerResultat(id: number, par: string) {
  const sql = await base();
  await sql`UPDATE resultats_recus SET statut = 'ignore', contenu = NULL, traite_le = now(), traite_par = ${par}
            WHERE id = ${id} AND statut = 'a_classer'`;
  await journaliser(par, "résultat reçu par email ignoré", null, String(id));
}

export async function listerResultats(): Promise<Resultat[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT r.id, r.labo, r.expediteur, r.sujet, r.nom_fichier, r.date_resultat, r.taille, r.statut, r.patient_id,
           r.candidats, r.recu_le, p.nom AS p_nom, p.prenom AS p_prenom
    FROM resultats_recus r LEFT JOIN patients p ON p.id = r.patient_id
    WHERE r.statut IN ('a_classer', 'a_relire') OR r.traite_le > now() - interval '14 days'
    ORDER BY (r.statut IN ('a_classer', 'a_relire')) DESC, r.recu_le DESC LIMIT 200`;
  const ids = [...new Set(lignes.flatMap((l) => l.candidats as number[]))];
  const noms = ids.length
    ? ((await sql`SELECT id, nom, prenom FROM patients WHERE id = ANY(${ids})`) as { id: number; nom: string; prenom: string }[])
    : [];
  return lignes.map((l) => ({
    id: l.id as number,
    labo: l.labo as string,
    expediteur: l.expediteur as string,
    sujet: l.sujet as string,
    nomFichier: l.nom_fichier as string,
    date: l.date_resultat as string,
    taille: l.taille as number,
    statut: l.statut as Resultat["statut"],
    patientId: l.patient_id as number | null,
    patientNom: l.p_nom ? `${(l.p_nom as string).toUpperCase()} ${l.p_prenom}` : "",
    candidats: (l.candidats as number[]).flatMap((c) => noms.filter((n) => n.id === c)),
    recuLe: l.recu_le as Date,
  }));
}

export async function lireContenuResultat(id: number) {
  const sql = await base();
  const [r] = await sql`SELECT nom_fichier, type_fichier, contenu FROM resultats_recus WHERE id = ${id} AND contenu IS NOT NULL`;
  return r ? { nom: r.nom_fichier as string, type: r.type_fichier as string, contenu: Buffer.from(r.contenu as string, "base64") } : null;
}

// Résultats reçus par e-mail qui ont donné lieu à ces examens : laboratoire et état (à relire, validé…)
export async function resultatsDesExamens(examenIds: number[]) {
  const resultats = new Map<number, { labo: string; statut: Resultat["statut"] }>();
  if (!examenIds.length) return resultats;
  const sql = await base();
  const lignes = await sql`SELECT examen_id, labo, statut FROM resultats_recus WHERE examen_id = ANY(${examenIds})`;
  for (const l of lignes) resultats.set(l.examen_id as number, { labo: l.labo as string, statut: l.statut as Resultat["statut"] });
  return resultats;
}

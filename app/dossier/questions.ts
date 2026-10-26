// Questions posées à l'assistant, avec la réponse, les passages cités et la note du médecin.
// Une réponse validée peut devenir une « fiche validée » de la bibliothèque.

import { jourLocal } from "../agenda/creneaux";
import type { Reponse } from "./assistant";
import { base } from "./base";
import { ajouterPages, creerSource, terminerSource } from "./bibliotheque";
import { dfg } from "./calculs";
import { listerConsultations } from "./consultations";
import type { DonneesETT } from "./ett";
import { listerExamens } from "./examens";
import { age, listerTraitements, lirePatient } from "./patients";

export type Question = {
  id: number;
  question: string;
  patientId: number | null;
  reponse: Reponse;
  note: -1 | 1 | null;
  commentaire: string;
  ficheId: number | null;
  creeLe: Date;
  creePar: string;
};

const enQuestion = (l: Record<string, unknown>): Question => ({
  id: l.id as number,
  question: l.question as string,
  patientId: l.patient_id as number | null,
  reponse: l.reponse as Reponse,
  note: l.note as Question["note"],
  commentaire: l.commentaire as string,
  ficheId: l.fiche_id as number | null,
  creeLe: l.cree_le as Date,
  creePar: l.cree_par as string,
});

export async function enregistrerQuestion(question: string, patientId: number | null, reponse: Reponse, par: string) {
  const sql = await base();
  const [ligne] = await sql`
    INSERT INTO questions (question, patient_id, reponse, cree_par)
    VALUES (${question}, ${patientId}, ${JSON.stringify(reponse)}::jsonb, ${par})
    RETURNING id`;
  return ligne.id as number;
}

export async function lireQuestion(id: number) {
  const sql = await base();
  const [ligne] = await sql`SELECT * FROM questions WHERE id = ${id}`;
  return ligne ? enQuestion(ligne) : null;
}

export async function listerQuestions(limite = 30) {
  const sql = await base();
  const lignes = await sql`SELECT * FROM questions ORDER BY cree_le DESC LIMIT ${limite}`;
  return lignes.map(enQuestion);
}

export async function noterQuestion(id: number, note: -1 | 1, commentaire: string) {
  const sql = await base();
  await sql`UPDATE questions SET note = ${note}, commentaire = ${commentaire} WHERE id = ${id}`;
}

// Texte de la fiche : la question, la réponse et la liste des sources citées
export function texteFiche(q: Pick<Question, "question" | "reponse">) {
  const cites = [...new Set(q.reponse.blocs.flatMap((b) => b.citations.map((c) => c.passage)))];
  const reponse = q.reponse.blocs
    .map((b) => b.texte)
    .join("")
    .trim();
  const sources = cites.map((i) => {
    const p = q.reponse.passages[i];
    return p ? `- ${p.source.libelle}${p.page ? `, p. ${p.page}` : ""}` : "";
  });
  return [`Question : ${q.question}`, "", reponse, ...(sources.length ? ["", "Sources :", ...sources] : [])].join("\n");
}

export async function creerFiche(q: Question, medecin: string, par: string) {
  const sql = await base();
  const id = await creerSource(
    {
      titre: q.question.slice(0, 200),
      organisme: medecin,
      annee: Number(jourLocal(new Date()).slice(0, 4)),
      type: "fiche",
      langue: "fr",
      url: "",
    },
    par,
  );
  await ajouterPages(id, [{ page: null, texte: texteFiche(q) }]);
  await terminerSource(id, 1);
  await sql`UPDATE questions SET fiche_id = ${id}, note = 1 WHERE id = ${q.id}`;
  return id;
}

// Résumé clinique sans nom ni coordonnées, joint à une question posée depuis un dossier. Il est montré au médecin
// avant l'envoi et conservé avec la réponse.
export async function resumeClinique(patientId: number) {
  const patient = await lirePatient(patientId);
  if (!patient) return null;
  const [traitements, consultations, examens] = await Promise.all([
    listerTraitements(patientId),
    listerConsultations(patientId),
    listerExamens(patientId),
  ]);
  const jour = (d: string) => d.split("-").reverse().join("/");
  const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const ans = age(patient.naissance, jourLocal(new Date()));
  // Consultations et ETT, du plus récent au plus ancien
  const releves = [
    ...consultations,
    ...examens.flatMap((e) => {
      const fevg = (e.valeurs.ett as DonneesETT | undefined)?.valeurs.fevg;
      return typeof fevg === "number"
        ? [
            {
              date: e.date,
              taSys: null,
              taDia: null,
              fc: null,
              poids: null,
              taille: null,
              mesures: { fevg } as Partial<Record<string, number>>,
            },
          ]
        : [];
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const derniere = <T>(valeur: (r: (typeof releves)[number]) => T | null | undefined) => {
    for (const r of releves) {
      const v = valeur(r);
      if (v !== null && v !== undefined) return { v, date: r.date };
    }
    return null;
  };

  const lignes: string[] = [];
  lignes.push(
    [
      patient.sexe === "F" ? "Femme" : patient.sexe === "M" ? "Homme" : "Sexe non renseigné",
      ans !== null ? `${ans} ans` : "",
    ]
      .filter(Boolean)
      .join(", "),
  );
  const poids = derniere((r) => r.poids);
  const taille = derniere((r) => r.taille);
  if (poids || taille) {
    lignes.push(
      [poids && `poids ${nombre(poids.v)} kg (${jour(poids.date)})`, taille && `taille ${taille.v} cm`]
        .filter(Boolean)
        .join(", "),
    );
  }
  if (patient.facteursRisque.length) lignes.push(`Facteurs de risque : ${patient.facteursRisque.join(", ")}`);
  if (patient.antecedents.trim()) lignes.push(`Antécédents : ${patient.antecedents.trim().slice(0, 600)}`);
  if (patient.allergies.trim()) lignes.push(`Allergies : ${patient.allergies.trim().slice(0, 300)}`);
  const enCours = traitements.filter((t) => !t.fin);
  lignes.push(
    `Traitements en cours : ${enCours.length ? enCours.map((t) => [t.medicament, t.posologie].filter(Boolean).join(" ")).join(" ; ") : "aucun renseigné"}`,
  );

  const valeurs: string[] = [];
  const ta = releves.find((r) => r.taSys !== null && r.taDia !== null);
  if (ta) valeurs.push(`TA ${ta.taSys}/${ta.taDia} mmHg (${jour(ta.date)})`);
  const fc = derniere((r) => r.fc);
  if (fc) valeurs.push(`FC ${fc.v} bpm (${jour(fc.date)})`);
  const inr = derniere((r) => r.mesures.inr);
  if (inr) valeurs.push(`INR ${nombre(inr.v)} (${jour(inr.date)})`);
  if (patient.inrMin !== null && patient.inrMax !== null) {
    valeurs.push(`zone cible d'INR ${nombre(patient.inrMin)}–${nombre(patient.inrMax)}`);
  }
  const fevg = derniere((r) => r.mesures.fevg);
  if (fevg) valeurs.push(`FEVG ${fevg.v} % (${jour(fevg.date)})`);
  const ldl = derniere((r) => r.mesures.ldl);
  if (ldl) valeurs.push(`LDL-c ${nombre(ldl.v)} g/L (${jour(ldl.date)})`);
  const creat = derniere((r) => r.mesures.creatinine);
  if (creat) {
    const debit = dfg(creat.v, ans, patient.sexe);
    valeurs.push(
      `créatinine ${nombre(creat.v)} mg/L (${jour(creat.date)})${debit !== null ? `, DFG CKD-EPI ${Math.round(debit)} mL/min/1,73 m²` : ""}`,
    );
  }
  const hba1c = derniere((r) => r.mesures.hba1c);
  if (hba1c) valeurs.push(`HbA1c ${nombre(hba1c.v)} % (${jour(hba1c.date)})`);
  const bnp = derniere((r) => r.mesures.ntprobnp);
  if (bnp) valeurs.push(`NT-proBNP ${nombre(bnp.v)} pg/mL (${jour(bnp.date)})`);
  if (valeurs.length) lignes.push(`Dernières valeurs : ${valeurs.join(" ; ")}`);
  return lignes.join("\n");
}

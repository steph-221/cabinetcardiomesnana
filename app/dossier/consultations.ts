// Consultations : les rubriques du rapport de consultation du cabinet (motif, examen physique, ECG, autres,
// conclusion), plus les valeurs chiffrées qui alimentent les courbes et les alertes.

import { base } from "./base";

// Valeurs saisies en consultation (biologie, échographie…), avec leurs bornes de vraisemblance
export const mesures = [
  { cle: "inr", libelle: "INR", unite: "", min: 0.5, max: 15 },
  { cle: "fevg", libelle: "FEVG", unite: "%", min: 5, max: 90 },
  { cle: "ldl", libelle: "LDL-c", unite: "g/L", min: 0.1, max: 6 },
  { cle: "creatinine", libelle: "Créatinine", unite: "mg/L", min: 1, max: 200 },
  { cle: "hba1c", libelle: "HbA1c", unite: "%", min: 3, max: 20 },
  { cle: "ntprobnp", libelle: "NT-proBNP", unite: "pg/mL", min: 1, max: 100000 },
] as const;

export type CleMesure = (typeof mesures)[number]["cle"];

export type Constantes = {
  taSys: number | null;
  taDia: number | null;
  fc: number | null;
  spo2: number | null;
  poids: number | null;
  taille: number | null;
};

// Bornes de vraisemblance des constantes (au-delà : faute de frappe probable)
export const bornesConstantes: Record<keyof Constantes, [number, number]> = {
  taSys: [50, 300],
  taDia: [20, 200],
  fc: [20, 250],
  spo2: [50, 100],
  poids: [1, 400],
  taille: [30, 250],
};

export type Consultation = Constantes & {
  id: number;
  date: string; // "AAAA-MM-JJ"
  motif: string;
  examen: string;
  ecg: string;
  mesures: Partial<Record<CleMesure, number>>;
  autres: string;
  conclusion: string;
  conduite: string;
  creePar: string;
  modifiePar: string;
};

export type SaisieConsultation = Omit<Consultation, "id" | "creePar" | "modifiePar">;

const nombre = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const versConsultation = (l: Record<string, unknown>): Consultation => ({
  id: l.id as number,
  date: l.date as string,
  motif: l.motif as string,
  taSys: nombre(l.ta_sys),
  taDia: nombre(l.ta_dia),
  fc: nombre(l.fc),
  spo2: nombre(l.spo2),
  poids: nombre(l.poids),
  taille: nombre(l.taille),
  examen: l.examen as string,
  ecg: l.ecg as string,
  mesures: l.mesures as Consultation["mesures"],
  autres: l.autres as string,
  conclusion: l.conclusion as string,
  conduite: l.conduite as string,
  creePar: l.cree_par as string,
  modifiePar: l.modifie_par as string,
});

// De la plus récente à la plus ancienne
export async function listerConsultations(patientId: number) {
  const sql = await base();
  const lignes = await sql`SELECT * FROM consultations WHERE patient_id = ${patientId} ORDER BY date DESC, id DESC`;
  return lignes.map(versConsultation);
}

export async function lireConsultation(patientId: number, id: number) {
  const sql = await base();
  const [ligne] = await sql`SELECT * FROM consultations WHERE id = ${id} AND patient_id = ${patientId}`;
  return ligne ? versConsultation(ligne) : null;
}

export async function enregistrerConsultation(
  patientId: number,
  id: number | null,
  c: SaisieConsultation,
  par: string,
) {
  const sql = await base();
  const mesuresJson = JSON.stringify(c.mesures);
  const ecriture =
    id === null
      ? sql`INSERT INTO consultations (patient_id, date, motif, ta_sys, ta_dia, fc, spo2, poids, taille, examen, ecg,
                                       mesures, autres, conclusion, conduite, cree_par, modifie_par)
            VALUES (${patientId}, ${c.date}, ${c.motif}, ${c.taSys}, ${c.taDia}, ${c.fc}, ${c.spo2}, ${c.poids},
                    ${c.taille}, ${c.examen}, ${c.ecg}, ${mesuresJson}::jsonb, ${c.autres}, ${c.conclusion},
                    ${c.conduite}, ${par}, ${par})
            RETURNING id`
      : sql`UPDATE consultations SET date = ${c.date}, motif = ${c.motif}, ta_sys = ${c.taSys}, ta_dia = ${c.taDia},
              fc = ${c.fc}, spo2 = ${c.spo2}, poids = ${c.poids}, taille = ${c.taille}, examen = ${c.examen},
              ecg = ${c.ecg}, mesures = ${mesuresJson}::jsonb, autres = ${c.autres}, conclusion = ${c.conclusion},
              conduite = ${c.conduite}, modifie_le = now(), modifie_par = ${par}
            WHERE id = ${id} AND patient_id = ${patientId}
            RETURNING id`;
  const [lignes] = await sql.transaction([
    ecriture,
    sql`UPDATE patients SET modifie_le = now(), modifie_par = ${par} WHERE id = ${patientId}`,
  ]);
  return (lignes[0]?.id as number | undefined) ?? null;
}

export async function supprimerConsultation(patientId: number, id: number) {
  const sql = await base();
  await sql`DELETE FROM consultations WHERE id = ${id} AND patient_id = ${patientId}`;
}

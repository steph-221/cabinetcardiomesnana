// Données du dossier reprises par défaut dans les calculs. Le médecin les vérifie et peut les modifier.
// Sans accès base : les consultations arrivent de la plus récente à la plus ancienne.

import type { DonneesDossier } from "./calculateurs/preremplissage";
import type { Consultation } from "./consultations";
import type { DonneesETT } from "./ett";
import type { Patient } from "./patients";

// FEVG mesurées dans les comptes rendus d'ETT du dossier
export const fevgDesExamens = (examens: { date: string; valeurs: Record<string, unknown> }[]) =>
  examens.flatMap((e) => {
    const fevg = (e.valeurs.ett as DonneesETT | undefined)?.valeurs.fevg;
    return typeof fevg === "number" ? [{ date: e.date, valeur: fevg }] : [];
  });

export function donneesPourCalculs({
  patient,
  age,
  consultations,
  fevgEchos,
  consultation,
}: {
  patient: Patient;
  age: number | null; // à la date du calcul
  consultations: Consultation[];
  fevgEchos: { date: string; valeur: number }[];
  // Calcul fait pendant cette consultation : ses propres mesures passent en premier
  consultation?: Consultation;
}): DonneesDossier {
  const ICI = "cette consultation";
  const DERNIERE = "dernière consultation";
  const derniere = <T>(valeur: (c: Consultation) => T | null | undefined) => {
    const trouvee = consultations.find((c) => valeur(c) !== null && valeur(c) !== undefined);
    return trouvee ? (valeur(trouvee) as T) : null;
  };

  // Poids et taille : mesure de la consultation, sinon fiche patient, sinon dernière consultation
  const poidsIci = consultation?.poids ?? null;
  const tailleIci = consultation?.taille ?? null;
  const poids = poidsIci ?? patient.poids ?? derniere((c) => c.poids);
  const taille = tailleIci ?? patient.taille ?? derniere((c) => c.taille);
  const origine = (ici: number | null, fiche: number | null) =>
    ici !== null ? ICI : fiche !== null ? "fiche patient" : DERNIERE;

  // FEVG et créatinine : mesure de la consultation, sinon la plus récente (consultation ou ETT), sinon rien (plus de valeurs de base dans la fiche)
  const fevgIci = consultation?.mesures.fevg ?? null;
  const dernierFevg = [
    ...consultations.flatMap((c) =>
      c.mesures.fevg !== undefined ? [{ date: c.date, valeur: c.mesures.fevg, origine: DERNIERE }] : [],
    ),
    ...fevgEchos.map((f) => ({ date: f.date, valeur: f.valeur, origine: "échographie du dossier" })),
  ].sort((a, b) => b.date.localeCompare(a.date))[0];
  const creatinineIci = consultation?.mesures.creatinine ?? null;
  const creatinineRecente = derniere((c) => c.mesures.creatinine);

  return {
    age,
    sexe: patient.sexe,
    poids,
    poidsOrigine: origine(poidsIci, patient.poids),
    taille,
    tailleOrigine: origine(tailleIci, patient.taille),
    fc: consultation?.fc ?? derniere((c) => c.fc),
    creatinine: creatinineIci ?? creatinineRecente,
    creatinineOrigine: creatinineIci !== null ? ICI : DERNIERE,
    fevg: fevgIci ?? dernierFevg?.valeur ?? null,
    fevgOrigine: fevgIci !== null ? ICI : (dernierFevg?.origine ?? DERNIERE),
    tabac: patient.tabac,
    alcoolVerres: patient.alcoolVerres,
    facteurs: patient.facteursRisque,
  };
}

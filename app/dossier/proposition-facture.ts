// Facture proposée en fin de consultation : la consultation du jour, plus un acte par examen réalisé le même jour.
// Les actes viennent des tarifs du cabinet (Comptabilité → Réglages) ; le secrétariat ou le médecin corrige avant
// d'enregistrer. Aucun accès à la base ici : module testable seul.

export type ActeTarif = { id: number; libelle: string };

const sansAccents = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Mots du type d'examen → mots à retrouver dans le libellé de l'acte
const CORRESPONDANCES: { examen: RegExp; acte: RegExp }[] = [
  { examen: /^ecg$|electrocardio/, acte: /electrocardio|\becg\b/ },
  { examen: /echocardio|\bett\b|echographie cardiaque$/, acte: /echocardio|\bett\b/ },
  { examen: /holter/, acte: /holter ecg|holter 24|holter cardiaque/ },
  { examen: /mapa|tensionnel/, acte: /mapa|holter tensionnel/ },
  { examen: /effort/, acte: /effort/ },
];

// Actes à proposer : l'acte de consultation (le premier dont le libellé commence par « consultation »), puis un acte
// par type d'examen du jour qui a son tarif. `idsConsultation` permet de préférer un contrôle à une consultation.
export function actesProposes(actes: ActeTarif[], typesExamens: string[], controle = false): number[] {
  const ids: number[] = [];
  const consultations = actes.filter((a) => /^consultation/.test(sansAccents(a.libelle)));
  const consultation = (controle ? consultations.find((a) => /controle/.test(sansAccents(a.libelle))) : null) ?? consultations.find((a) => !/controle/.test(sansAccents(a.libelle))) ?? consultations[0];
  if (consultation) ids.push(consultation.id);
  for (const type of typesExamens) {
    const t = sansAccents(type);
    const regle = CORRESPONDANCES.find((c) => c.examen.test(t));
    const acte = regle && actes.find((a) => regle.acte.test(sansAccents(a.libelle)));
    if (acte && !ids.includes(acte.id)) ids.push(acte.id);
  }
  return ids;
}

// Paramètre d'adresse « actes=1,4 » → identifiants valides, dans l'ordre, sans doublon
export function lireActesDemandes(brut: unknown, disponibles: ActeTarif[]): number[] {
  const texte = Array.isArray(brut) ? brut[0] : brut;
  if (typeof texte !== "string") return [];
  const valides = new Set(disponibles.map((a) => a.id));
  return [...new Set(texte.split(",").map(Number).filter((n) => Number.isInteger(n) && valides.has(n)))];
}

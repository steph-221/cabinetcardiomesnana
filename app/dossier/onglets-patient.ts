// Sections de la fiche patient, dans l'ordre où le médecin en a besoin. Sans accès base : testé à part.

export type CleOnglet = "apercu" | "consultations" | "evolution" | "examens" | "documents" | "fiche";

export const onglets: { cle: CleOnglet; libelle: string; medical: boolean }[] = [
  { cle: "apercu", libelle: "Aperçu", medical: false },
  { cle: "consultations", libelle: "Consultations", medical: true },
  { cle: "evolution", libelle: "Évolution et calculs", medical: true },
  { cle: "examens", libelle: "Examens", medical: false },
  { cle: "documents", libelle: "Ordonnances et factures", medical: false },
  { cle: "fiche", libelle: "Fiche", medical: false },
];

export const ongletsDisponibles = (medical: boolean) => onglets.filter((o) => medical || !o.medical);

// Onglet demandé dans l'adresse (?onglet=…) ; à défaut ou s'il n'est pas permis, l'aperçu
export function ongletValide(brut: string | string[] | undefined, medical: boolean): CleOnglet {
  const demande = Array.isArray(brut) ? brut[0] : brut;
  return ongletsDisponibles(medical).find((o) => o.cle === demande)?.cle ?? "apercu";
}

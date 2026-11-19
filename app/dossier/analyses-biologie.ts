// Catalogue des analyses biologiques que le cabinet prescrit d'habitude, pour la prescription par cases à cocher.
// Pour ajouter ou retirer une analyse, il suffit de modifier ce fichier. Module sans accès base.

export type GroupeAnalyses = { titre: string; analyses: string[] };

export const catalogue: GroupeAnalyses[] = [
  { titre: "Hématologie", analyses: ["NFS", "Plaquettes", "VS", "Ferritine", "Fer sérique", "Coefficient de saturation de la transferrine"] },
  { titre: "Glycémie et diabète", analyses: ["Glycémie à jeun", "HbA1c", "Microalbuminurie des 24 h"] },
  { titre: "Bilan lipidique", analyses: ["Cholestérol total", "HDL-cholestérol", "LDL-cholestérol", "Triglycérides"] },
  {
    titre: "Fonction rénale et ionogramme",
    analyses: ["Créatinine (avec DFG)", "Urée", "Ionogramme sanguin (Na, K, Cl)", "Calcémie", "Magnésémie", "Acide urique", "Protéinurie des 24 h", "ECBU"],
  },
  { titre: "Bilan hépatique", analyses: ["ASAT", "ALAT", "Gamma GT", "Phosphatases alcalines", "Bilirubine totale et conjuguée"] },
  { titre: "Hémostase", analyses: ["INR", "TP", "TCA", "D-dimères", "Fibrinogène"] },
  { titre: "Marqueurs cardiaques et inflammation", analyses: ["NT-proBNP", "Troponine ultrasensible", "CPK", "CRP"] },
  { titre: "Endocrinologie et divers", analyses: ["TSH", "T4 libre", "Vitamine D (25-OH)", "Groupage sanguin ABO Rhésus", "Sérologie VIH", "Sérologie hépatite B et C"] },
];

export const toutesLesAnalyses = catalogue.flatMap((g) => g.analyses);

// Bilans habituels : un clic coche plusieurs analyses
export const bilans: { titre: string; analyses: string[] }[] = [
  { titre: "Bilan initial HTA", analyses: ["NFS", "Glycémie à jeun", "Créatinine (avec DFG)", "Ionogramme sanguin (Na, K, Cl)", "Cholestérol total", "HDL-cholestérol", "LDL-cholestérol", "Triglycérides", "Acide urique", "TSH", "Microalbuminurie des 24 h"] },
  { titre: "Bilan lipidique", analyses: ["Cholestérol total", "HDL-cholestérol", "LDL-cholestérol", "Triglycérides"] },
  { titre: "Avant statine", analyses: ["Cholestérol total", "HDL-cholestérol", "LDL-cholestérol", "Triglycérides", "ASAT", "ALAT", "CPK", "TSH"] },
  { titre: "Suivi traitement anticoagulant (AVK)", analyses: ["INR"] },
  { titre: "Suivi insuffisance cardiaque", analyses: ["NFS", "Créatinine (avec DFG)", "Ionogramme sanguin (Na, K, Cl)", "NT-proBNP", "Ferritine", "Coefficient de saturation de la transferrine", "TSH"] },
  { titre: "Douleur thoracique", analyses: ["Troponine ultrasensible", "NFS", "CRP", "D-dimères", "Créatinine (avec DFG)"] },
  { titre: "Bilan pré-opératoire", analyses: ["NFS", "TP", "TCA", "Glycémie à jeun", "Créatinine (avec DFG)", "Ionogramme sanguin (Na, K, Cl)", "Groupage sanguin ABO Rhésus"] },
];

// Analyses reçues du formulaire : seules celles du catalogue sont retenues, sans doublon, dans l'ordre du catalogue
export function analysesValides(saisies: string[]) {
  const choisies = new Set(saisies.map((s) => s.trim()));
  return toutesLesAnalyses.filter((a) => choisies.has(a));
}

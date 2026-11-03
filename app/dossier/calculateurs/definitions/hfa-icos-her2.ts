import { pointsChamp, type Calculateur, type Champ, type Resultat, type Valeurs } from "../types";

// Risque cardiovasculaire de base avant un traitement anti-HER2 (trastuzumab, pertuzumab, T-DM1, lapatinib, neratinib).
// Tableau 3 de Lyon AR et al., Eur J Heart Fail 2020 (HFA-ICOS).
// Niveaux : moyen 1 (1 point), moyen 2 (2 points), élevé, très élevé. Un facteur élevé ou très élevé suffit à lui seul.
export type NiveauFacteur = "m1" | "m2" | "eleve" | "tres-eleve";

type Facteur = { cle: string; libelle: string; groupe: string; niveau: NiveauFacteur; aide?: string };

const CV = "Maladie cardiovasculaire préexistante";
const BIO = "Biomarqueurs cardiaques (si disponibles)";
const AGE = "Âge et facteurs de risque cardiovasculaire";
const TTT = "Traitement anticancéreux";

export const facteursHfaIcosHer2: Facteur[] = [
  { cle: "ic", libelle: "Insuffisance cardiaque ou cardiomyopathie", groupe: CV, niveau: "tres-eleve" },
  { cle: "coronaropathie", libelle: "Infarctus du myocarde ou pontage aorto-coronarien", groupe: CV, niveau: "eleve" },
  { cle: "angor", libelle: "Angor stable", groupe: CV, niveau: "eleve" },
  { cle: "valvulopathie", libelle: "Valvulopathie sévère", groupe: CV, niveau: "eleve" },
  { cle: "arythmie", libelle: "Arythmie : fibrillation ou flutter atrial, tachycardie ou fibrillation ventriculaire", groupe: CV, niveau: "m2" },
  { cle: "troponine", libelle: "Troponine de base élevée", groupe: BIO, niveau: "m2", aide: "Au-dessus de la limite supérieure du laboratoire" },
  { cle: "peptides", libelle: "BNP ou NT-proBNP de base élevé", groupe: BIO, niveau: "m2", aide: "Au-dessus de la limite supérieure du laboratoire" },
  { cle: "hta", libelle: "Hypertension artérielle", groupe: AGE, niveau: "m1", aide: "PAS > 140 ou PAD > 90 mmHg, ou traitée" },
  { cle: "diabete", libelle: "Diabète", groupe: AGE, niveau: "m1", aide: "HbA1c > 7,0 % (53 mmol/mol), ou traité" },
  { cle: "irc", libelle: "Insuffisance rénale chronique", groupe: AGE, niveau: "m1", aide: "DFG < 60 mL/min/1,73 m²" },
  { cle: "tabac", libelle: "Tabagisme actuel ou important", groupe: AGE, niveau: "m1" },
  { cle: "obesite", libelle: "Obésité (IMC > 30 kg/m²)", groupe: AGE, niveau: "m1" },
  { cle: "trastuzumab", libelle: "Cardiotoxicité antérieure du trastuzumab", groupe: TTT, niveau: "tres-eleve" },
  { cle: "anthracycline", libelle: "Exposition ancienne à une anthracycline", groupe: TTT, niveau: "m2", aide: "Cancer antérieur, hors traitement en cours" },
  { cle: "radiotherapie", libelle: "Radiothérapie antérieure du thorax gauche ou du médiastin", groupe: TTT, niveau: "m2" },
];

const POINTS: Record<NiveauFacteur, number> = { m1: 1, m2: 2, eleve: 0, "tres-eleve": 0 };
const ETIQUETTE: Record<NiveauFacteur, string> = {
  m1: "Moyen 1",
  m2: "Moyen 2",
  eleve: "Risque élevé",
  "tres-eleve": "Risque très élevé",
};

const champs: Champ[] = [
  ...facteursHfaIcosHer2.map((f) => ({
    type: "case" as const,
    cle: f.cle,
    libelle: f.libelle,
    groupe: f.groupe,
    points: POINTS[f.niveau],
    aide: [ETIQUETTE[f.niveau], f.aide].filter(Boolean).join(" · "),
  })),
  {
    type: "choix",
    cle: "fevg",
    libelle: "FEVG de base",
    groupe: CV,
    options: [
      { valeur: "normale", libelle: "≥ 55 % (ou non connue)", points: 0 },
      { valeur: "limite", libelle: "50 à 54 % (moyen 2)", points: 2 },
      { valeur: "basse", libelle: "< 50 % (risque élevé)", points: 0 },
    ],
  },
  {
    type: "choix",
    cle: "age",
    libelle: "Âge",
    groupe: AGE,
    options: [
      { valeur: "moins65", libelle: "Moins de 65 ans", points: 0 },
      { valeur: "65-79", libelle: "65 à 79 ans (moyen 2)", points: 2 },
      { valeur: "80", libelle: "80 ans ou plus (risque élevé)", points: 0 },
    ],
  },
  {
    type: "choix",
    cle: "anthracyclineActuelle",
    libelle: "Anthracycline dans le schéma actuel",
    groupe: TTT,
    options: [
      { valeur: "non", libelle: "Non", points: 0 },
      { valeur: "avant", libelle: "Avant le traitement anti-HER2 (moyen 1)", points: 1 },
      { valeur: "concomitante", libelle: "En même temps que le trastuzumab (risque élevé)", points: 0 },
    ],
  },
];

export function evaluerHfaIcosHer2(valeurs: Valeurs): Resultat {
  const niveaux: NiveauFacteur[] = facteursHfaIcosHer2.filter((f) => valeurs[f.cle] === true).map((f) => f.niveau);
  if (valeurs.fevg === "basse") niveaux.push("eleve");
  if (valeurs.age === "80") niveaux.push("eleve");
  if (valeurs.anthracyclineActuelle === "concomitante") niveaux.push("eleve");

  const points = champs.reduce((somme, c) => somme + pointsChamp(c, valeurs), 0);

  if (niveaux.includes("tres-eleve")) return { score: points, libelle: "Risque très élevé", gravite: "tres-eleve", recommandation: RECO };
  // Un facteur élevé suffit, tout comme 5 points ou plus de facteurs moyens
  if (niveaux.includes("eleve") || points >= 5)
    return { score: points, libelle: "Risque élevé", gravite: "eleve", recommandation: RECO };
  if (points >= 2) return { score: points, libelle: "Risque moyen", gravite: "moyen", recommandation: RECO };
  return { score: points, libelle: "Risque faible", gravite: "faible", recommandation: RECO };
}

const RECO =
  "Faible : traitement sans bilan complémentaire. Moyen à très élevé : avis cardio-oncologique avant le traitement, optimisation des facteurs de risque et surveillance renforcée (ETT, troponine, peptides natriurétiques). Le médecin garde la décision.";

export const hfaIcosHer2: Calculateur = {
  slug: "hfa-icos-her2",
  titre: "HFA-ICOS : risque cardio-oncologique de base (anti-HER2)",
  resume: "Risque de cardiotoxicité avant trastuzumab, pertuzumab, T-DM1, lapatinib ou neratinib.",
  specialite: "cardio-oncologie",
  champs,
  evaluer: evaluerHfaIcosHer2,
  notes: [
    "Règle : faible = aucun facteur ou un seul facteur moyen 1 ; moyen = facteurs moyens totalisant 2 à 4 points ; élevé = 5 points ou plus, ou un facteur élevé ; très élevé = un facteur très élevé.",
    "Moyen 1 vaut 1 point et moyen 2 vaut 2 points.",
  ],
  source: {
    libelle: "Lyon AR et al., Eur J Heart Fail 2020 (HFA-ICOS), tableau 3",
    url: "https://doi.org/10.1002/ejhf.1920",
  },
  verification:
    "Points et seuils vérifiés ligne à ligne contre le tableau 3 de la publication (manuscrit auteur). Les recommandations ESC 2022 reprennent cet outil : à confirmer si elles diffèrent.",
};

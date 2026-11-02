import { pointsChamp, type Calculateur, type Champ, type Resultat, type Valeurs } from "../types";

// Évaluation du risque cardiovasculaire de base avant un traitement anti-HER2 (HFA-ICOS).
// Chaque facteur a un niveau : faible (aucun point), moyen 1 (1 point), moyen 2 (2 points), élevé, très élevé.
// Les points ne servent qu'aux facteurs « moyens » ; un facteur élevé ou très élevé suffit à lui seul.
export type NiveauFacteur = "m1" | "m2" | "eleve" | "tres-eleve";

type Facteur = { cle: string; libelle: string; groupe: string; niveau: NiveauFacteur };

export const facteursHfaIcosHer2: Facteur[] = [
  // Maladie cardiovasculaire préexistante
  { cle: "ic", libelle: "Insuffisance cardiaque ou cardiomyopathie", groupe: "Maladie cardiovasculaire préexistante", niveau: "tres-eleve" },
  { cle: "valvulopathie", libelle: "Valvulopathie sévère", groupe: "Maladie cardiovasculaire préexistante", niveau: "eleve" },
  { cle: "coronaropathie", libelle: "Infarctus du myocarde ou revascularisation coronaire antérieure", groupe: "Maladie cardiovasculaire préexistante", niveau: "eleve" },
  { cle: "angor", libelle: "Angor stable", groupe: "Maladie cardiovasculaire préexistante", niveau: "eleve" },
  { cle: "troponine", libelle: "Troponine de base élevée", groupe: "Maladie cardiovasculaire préexistante", niveau: "m1" },
  { cle: "peptides", libelle: "BNP ou NT-proBNP de base élevé", groupe: "Maladie cardiovasculaire préexistante", niveau: "m1" },
  // Facteurs de risque cardiovasculaire
  { cle: "hta", libelle: "Hypertension artérielle", groupe: "Âge et facteurs de risque", niveau: "m1" },
  { cle: "diabete", libelle: "Diabète", groupe: "Âge et facteurs de risque", niveau: "m1" },
  { cle: "irc", libelle: "Insuffisance rénale chronique", groupe: "Âge et facteurs de risque", niveau: "m1" },
  { cle: "tabac", libelle: "Tabagisme actuel ou important", groupe: "Âge et facteurs de risque", niveau: "m1" },
  { cle: "obesite", libelle: "Obésité (IMC > 30 kg/m²)", groupe: "Âge et facteurs de risque", niveau: "m1" },
  // Traitements anticancéreux antérieurs
  { cle: "anthracycline", libelle: "Anthracycline antérieure", groupe: "Traitements anticancéreux antérieurs", niveau: "eleve" },
  { cle: "radiotherapie", libelle: "Radiothérapie antérieure du thorax gauche ou du médiastin", groupe: "Traitements anticancéreux antérieurs", niveau: "m2" },
  { cle: "chimio", libelle: "Chimiothérapie antérieure sans anthracycline", groupe: "Traitements anticancéreux antérieurs", niveau: "m1" },
];

const POINTS: Record<NiveauFacteur, number> = { m1: 1, m2: 2, eleve: 0, "tres-eleve": 0 };

const champs: Champ[] = [
  ...facteursHfaIcosHer2.map((f) => ({
    type: "case" as const,
    cle: f.cle,
    libelle: f.libelle,
    groupe: f.groupe,
    points: POINTS[f.niveau],
    aide: f.niveau === "eleve" ? "Risque élevé" : f.niveau === "tres-eleve" ? "Risque très élevé" : undefined,
  })),
  {
    type: "choix",
    cle: "fevg",
    libelle: "FEVG de base",
    groupe: "Maladie cardiovasculaire préexistante",
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
    groupe: "Âge et facteurs de risque",
    options: [
      { valeur: "moins65", libelle: "Moins de 65 ans", points: 0 },
      { valeur: "65-79", libelle: "65 à 79 ans (moyen 2)", points: 2 },
      { valeur: "80", libelle: "80 ans ou plus (risque élevé)", points: 0 },
    ],
  },
];

export function evaluerHfaIcosHer2(valeurs: Valeurs): Resultat {
  const niveauxCoches = facteursHfaIcosHer2.filter((f) => valeurs[f.cle] === true).map((f) => f.niveau);
  if (valeurs.fevg === "basse") niveauxCoches.push("eleve");
  if (valeurs.age === "80") niveauxCoches.push("eleve");

  const points = champs.reduce((somme, c) => somme + pointsChamp(c, valeurs), 0);

  if (niveauxCoches.includes("tres-eleve"))
    return { score: points, libelle: "Risque très élevé", gravite: "tres-eleve", recommandation: RECO };
  // Un facteur « élevé » suffit, tout comme 5 points ou plus de facteurs moyens
  if (niveauxCoches.includes("eleve") || points >= 5)
    return { score: points, libelle: "Risque élevé", gravite: "eleve", recommandation: RECO };
  if (points >= 2) return { score: points, libelle: "Risque moyen", gravite: "moyen", recommandation: RECO };
  return { score: points, libelle: "Risque faible", gravite: "faible", recommandation: RECO };
}

const RECO =
  "Faible : traitement sans bilan complémentaire. Moyen à très élevé : avis cardio-oncologique avant le traitement, optimisation des facteurs de risque et surveillance renforcée (ETT, troponine, peptides natriurétiques). Le médecin garde la décision.";

export const hfaIcosHer2: Calculateur = {
  slug: "hfa-icos-her2",
  titre: "HFA-ICOS : risque cardio-oncologique de base (anti-HER2)",
  resume: "Risque de cardiotoxicité avant trastuzumab, pertuzumab ou autre thérapie ciblant HER2.",
  specialite: "cardio-oncologie",
  champs,
  evaluer: evaluerHfaIcosHer2,
  notes: [
    "Niveaux : faible = aucun facteur ou un seul facteur moyen 1 (1 point) ; moyen = facteurs moyens totalisant 2 à 4 points ; élevé = 5 points ou plus, ou un facteur à risque élevé ; très élevé = insuffisance cardiaque ou cardiomyopathie.",
    "Troponine et peptides natriurétiques : seuils propres au laboratoire (élevé = au-dessus de la limite supérieure de la normale).",
  ],
  source: {
    libelle: "Lyon AR et al., recommandations ESC 2022 sur la cardio-oncologie (HFA-ICOS, Eur Heart J)",
    url: "https://doi.org/10.1093/eurheartj/ehac244",
  },
  verification:
    "Points et seuils saisis d'après la publication HFA-ICOS (Lyon 2020, repris par les recommandations ESC 2022). Les sites de l'éditeur étaient inaccessibles depuis l'environnement de développement : à relire contre le tableau de la publication avant usage clinique.",
};

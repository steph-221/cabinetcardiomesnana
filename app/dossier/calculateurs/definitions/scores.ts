import { calculateurParPoints, totalPoints, type Calculateur, type Champ } from "../types";

const case1 = (cle: string, libelle: string, points = 1, groupe?: string): Champ => ({
  type: "case",
  cle,
  libelle,
  points,
  groupe,
});

const choix = (cle: string, libelle: string, options: [string, number][], groupe?: string): Champ => ({
  type: "choix",
  cle,
  libelle,
  groupe,
  options: options.map(([libelle, points], i) => ({ valeur: String(i), libelle, points })),
});

const VERIFICATION =
  "Points et seuils saisis de mémoire d'après la publication d'origine, sans pouvoir la consulter depuis l'environnement de développement : à relire contre la publication avant usage clinique.";

// Les recommandations ESC 2020 raisonnent sur le score sans le point du sexe féminin :
// ≥ 2 anticoagulation recommandée, 1 à envisager (soit ≥ 3 et 2 chez la femme)
const champsVasc: Champ[] = [
  case1("icc", "Insuffisance cardiaque ou dysfonction VG"),
  case1("hta", "Hypertension artérielle"),
  case1("diabete", "Diabète"),
  case1("avc", "AVC, AIT ou embolie artérielle", 2),
  case1("vasculaire", "Maladie vasculaire (IDM, artériopathie, plaque aortique)"),
  case1("femme", "Sexe féminin"),
  choix("age", "Âge", [["Moins de 65 ans", 0], ["65 à 74 ans", 1], ["75 ans ou plus", 2]]),
];

export const cha2ds2vasc: Calculateur = {
  slug: "cha2ds2-vasc",
  titre: "CHA₂DS₂-VASc",
  resume: "Risque thromboembolique en cas de fibrillation atriale (version avec le sexe féminin).",
  specialite: "cardiologie",
  champs: champsVasc,
  evaluer(valeurs) {
    const score = totalPoints(champsVasc, valeurs);
    const sansSexe = score - (valeurs.femme === true ? 1 : 0);
    if (sansSexe >= 2)
      return { score, libelle: "Anticoagulation orale recommandée", gravite: "eleve" };
    if (sansSexe === 1)
      return { score, libelle: "Anticoagulation orale à envisager", gravite: "moyen" };
    return { score, libelle: "Pas d'indication d'anticoagulation sur ce seul score", gravite: "faible" };
  },
  notes: ["Les recommandations ESC 2024 utilisent CHA₂DS₂-VA (sans le sexe) : voir ce calculateur."],
  source: { libelle: "Lip GYH et al., Chest 2010", url: "https://doi.org/10.1378/chest.09-1584" },
  verification: VERIFICATION,
};

export const hasBled = calculateurParPoints({
  slug: "has-bled",
  titre: "HAS-BLED",
  resume: "Risque hémorragique sous anticoagulant en cas de fibrillation atriale.",
  specialite: "cardiologie",
  champs: [
    case1("hta", "Hypertension non contrôlée (PAS > 160 mmHg)"),
    case1("rein", "Atteinte rénale (dialyse, greffe ou créatinine > 22,6 mg/L)"),
    case1("foie", "Atteinte hépatique (cirrhose ou bilirubine > 2 N avec ASAT/ALAT > 3 N)"),
    case1("avc", "Antécédent d'AVC"),
    case1("saignement", "Antécédent de saignement majeur ou prédisposition (anémie, thrombopénie)"),
    case1("inr", "INR labile (temps dans la cible < 60 %)"),
    case1("age", "Âge > 65 ans"),
    case1("antiplaquettaire", "Antiplaquettaire ou AINS"),
    case1("alcool", "Alcool (≥ 8 verres par semaine)"),
  ],
  paliers: [
    { min: 3, libelle: "Risque hémorragique élevé", gravite: "eleve", recommandation: "Corriger les facteurs modifiables et surveiller de près ; ce n'est pas une contre-indication à l'anticoagulation." },
    { min: 1, libelle: "Risque hémorragique faible à modéré", gravite: "moyen" },
    { min: 0, libelle: "Risque hémorragique faible", gravite: "faible" },
  ],
  source: { libelle: "Pisters R et al., Chest 2010", url: "https://doi.org/10.1378/chest.10-0134" },
  verification: VERIFICATION,
});

export const heart = calculateurParPoints({
  slug: "heart",
  titre: "Score HEART",
  resume: "Risque d'événement cardiaque majeur à 6 semaines devant une douleur thoracique aux urgences.",
  specialite: "urgences",
  champs: [
    choix("histoire", "Histoire clinique", [["Peu suspecte", 0], ["Modérément suspecte", 1], ["Très suspecte", 2]]),
    choix("ecg", "ECG", [["Normal", 0], ["Troubles non spécifiques de la repolarisation", 1], ["Déviation significative du segment ST", 2]]),
    choix("age", "Âge", [["Moins de 45 ans", 0], ["45 à 64 ans", 1], ["65 ans ou plus", 2]]),
    choix("risque", "Facteurs de risque", [["Aucun", 0], ["1 ou 2 facteurs", 1], ["3 facteurs ou plus, ou maladie athéromateuse connue", 2]]),
    choix("troponine", "Troponine", [["Normale", 0], ["1 à 3 fois la normale", 1], ["Plus de 3 fois la normale", 2]]),
  ],
  paliers: [
    { min: 7, libelle: "Risque élevé", gravite: "eleve", recommandation: "Stratégie invasive précoce, hospitalisation." },
    { min: 4, libelle: "Risque intermédiaire", gravite: "moyen", recommandation: "Observation et explorations complémentaires." },
    { min: 0, libelle: "Risque faible", gravite: "faible", recommandation: "Sortie envisageable si le contexte le permet." },
  ],
  notes: ["Facteurs de risque : HTA, hypercholestérolémie, diabète, tabagisme, obésité, antécédent familial."],
  source: { libelle: "Six AJ et al., Neth Heart J 2008" },
  verification: VERIFICATION,
});

export const timiNstemi = calculateurParPoints({
  slug: "timi-nstemi",
  titre: "TIMI angor instable / NSTEMI",
  resume: "Risque d'événement à 14 jours dans un syndrome coronarien aigu sans sus-décalage de ST.",
  specialite: "cardiologie",
  champs: [
    case1("age", "Âge ≥ 65 ans"),
    case1("facteurs", "Au moins 3 facteurs de risque coronarien"),
    case1("stenose", "Sténose coronaire connue ≥ 50 %"),
    case1("aspirine", "Aspirine dans les 7 derniers jours"),
    case1("angor", "Au moins 2 épisodes d'angor sévère en 24 h"),
    case1("st", "Déviation du segment ST ≥ 0,5 mm"),
    case1("marqueurs", "Marqueurs cardiaques élevés"),
  ],
  paliers: [
    { min: 5, libelle: "Risque élevé", gravite: "eleve" },
    { min: 3, libelle: "Risque intermédiaire", gravite: "moyen" },
    { min: 0, libelle: "Risque faible", gravite: "faible" },
  ],
  notes: ["Regroupement en trois niveaux (0-2, 3-4, 5-7) : les pourcentages de risque sont à lire dans la publication."],
  source: { libelle: "Antman EM et al., JAMA 2000" },
  verification: VERIFICATION,
});

export const wellsEp = calculateurParPoints({
  slug: "wells-ep",
  titre: "Wells : embolie pulmonaire",
  resume: "Probabilité clinique d'embolie pulmonaire avant D-dimères ou angioscanner.",
  specialite: "urgences",
  champs: [
    case1("tvp", "Signes cliniques de thrombose veineuse profonde", 3),
    case1("diagnostic", "Embolie pulmonaire plus probable que tout autre diagnostic", 3),
    case1("fc", "Fréquence cardiaque > 100/min", 1.5),
    case1("immobilisation", "Immobilisation ≥ 3 jours ou chirurgie dans les 4 semaines", 1.5),
    case1("antecedent", "Antécédent de TVP ou d'embolie pulmonaire", 1.5),
    case1("hemoptysie", "Hémoptysie"),
    case1("cancer", "Cancer actif ou traité depuis moins de 6 mois"),
  ],
  paliers: [
    { min: 4.5, libelle: "Embolie pulmonaire probable (> 4) : imagerie directe", gravite: "eleve" },
    { min: 2, libelle: "Embolie pulmonaire peu probable (≤ 4), probabilité intermédiaire : D-dimères", gravite: "moyen" },
    { min: 0, libelle: "Embolie pulmonaire peu probable (≤ 4), probabilité faible : D-dimères", gravite: "faible" },
  ],
  notes: ["Version à trois niveaux (< 2, 2 à 6, > 6) et à deux niveaux (≤ 4, > 4) : le résultat suit la version à deux niveaux."],
  source: { libelle: "Wells PS et al., Thromb Haemost 2000" },
  verification: VERIFICATION,
});

export const wellsTvp = calculateurParPoints({
  slug: "wells-tvp",
  titre: "Wells : thrombose veineuse profonde",
  resume: "Probabilité clinique de thrombose veineuse profonde d'un membre inférieur.",
  specialite: "urgences",
  champs: [
    case1("cancer", "Cancer actif"),
    case1("paralysie", "Paralysie, parésie ou immobilisation plâtrée récente du membre"),
    case1("alitement", "Alitement ≥ 3 jours ou chirurgie majeure dans les 12 dernières semaines"),
    case1("douleur", "Douleur localisée le long du système veineux profond"),
    case1("jambe", "Tout le membre gonflé"),
    case1("mollet", "Mollet gonflé de plus de 3 cm par rapport à l'autre"),
    case1("godet", "Œdème prenant le godet (côté symptomatique)"),
    case1("collaterales", "Circulation veineuse collatérale superficielle"),
    case1("antecedent", "Antécédent de thrombose veineuse profonde"),
    case1("autre", "Diagnostic alternatif au moins aussi probable", -2),
  ],
  paliers: [
    { min: 3, libelle: "Probabilité élevée", gravite: "eleve" },
    { min: 1, libelle: "Probabilité intermédiaire", gravite: "moyen" },
    { min: -99, libelle: "Probabilité faible", gravite: "faible" },
  ],
  source: { libelle: "Wells PS et al., Lancet 1997" },
  verification: VERIFICATION,
});

export const spesi = calculateurParPoints({
  slug: "spesi",
  titre: "sPESI",
  resume: "Pronostic à 30 jours d'une embolie pulmonaire confirmée.",
  specialite: "urgences",
  champs: [
    case1("age", "Âge > 80 ans"),
    case1("cancer", "Cancer"),
    case1("cardiopulmonaire", "Insuffisance cardiaque ou maladie respiratoire chronique"),
    case1("fc", "Fréquence cardiaque ≥ 110/min"),
    case1("pas", "Pression artérielle systolique < 100 mmHg"),
    case1("sao2", "Saturation en oxygène < 90 %"),
  ],
  paliers: [
    { min: 1, libelle: "Risque élevé de mortalité à 30 jours", gravite: "eleve" },
    { min: 0, libelle: "Risque faible de mortalité à 30 jours", gravite: "faible" },
  ],
  source: { libelle: "Jiménez D et al., Arch Intern Med 2010" },
  verification: VERIFICATION,
});

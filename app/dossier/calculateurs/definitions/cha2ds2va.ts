import { criteresCha2ds2va } from "../../calculs";
import { totalPoints, type Calculateur } from "../types";

// Même score que dans calculs.ts (cha2ds2va), exprimé dans le schéma commun
export const cha2ds2vaCalculateur: Calculateur = {
  slug: "cha2ds2-va",
  titre: "CHA₂DS₂-VA",
  resume: "Risque thromboembolique en cas de fibrillation atriale (ESC 2024).",
  specialite: "cardiologie",
  champs: [
    ...criteresCha2ds2va
      .filter((c) => c.cle !== "age75" && c.cle !== "age65")
      .map((c) => ({ type: "case" as const, cle: c.cle, libelle: c.libelle, points: c.points })),
    {
      type: "choix",
      cle: "age",
      libelle: "Âge",
      options: [
        { valeur: "moins65", libelle: "Moins de 65 ans", points: 0 },
        { valeur: "age65", libelle: "65 à 74 ans", points: 1 },
        { valeur: "age75", libelle: "75 ans ou plus", points: 2 },
      ],
    },
  ],
  evaluer(valeurs) {
    const score = totalPoints(this.champs, valeurs);
    if (score >= 2)
      return { score, libelle: "Anticoagulation orale recommandée (classe I)", gravite: "eleve" };
    if (score === 1)
      return { score, libelle: "Anticoagulation orale à envisager (classe IIa)", gravite: "moyen" };
    return { score, libelle: "Pas d'indication d'anticoagulation sur ce seul score", gravite: "faible" };
  },
  notes: [
    "En cas de fibrillation atriale. Ne s'applique pas en cas de valve mécanique ou de rétrécissement mitral modéré à serré (AVK dans tous les cas).",
  ],
  source: {
    libelle: "Recommandations ESC 2024 sur la fibrillation atriale",
    url: "https://doi.org/10.1093/eurheartj/ehae176",
  },
  verification: "Reprise du score déjà codé dans l'application (calculs.ts).",
};

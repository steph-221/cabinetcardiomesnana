import { fr, nombre, texte, type ModeleExamen, type Proposition, type ValeursExamen } from "../types";

const ARRETS = [
  "épuisement ou fatigue musculaire",
  "fréquence maximale théorique atteinte",
  "dyspnée",
  "douleur thoracique",
  "sous-décalage de ST",
  "arythmie",
  "chute tensionnelle",
  "hypertension sévère à l'effort",
  "demande du patient",
  "autre",
];
const PENTES = ["sans sous-décalage", "ascendant lent", "horizontal", "descendant"];
const ANGOR = ["absent", "non limitant", "limitant"];

export const fmt = (age: number) => 220 - age;

// Score de Duke (tapis, Bruce) : durée (min) − 5 × sous-décalage de ST (mm) − 4 × indice d'angor (0, 1, 2)
export function duke(v: ValeursExamen) {
  if (texte(v, "type") !== "tapis roulant") return null;
  const duree = nombre(v, "duree");
  const angor = ANGOR.indexOf(texte(v, "angor"));
  if (duree === null || angor < 0) return null;
  const pente = texte(v, "stPente");
  const st = pente === "horizontal" || pente === "descendant" ? (nombre(v, "stMax") ?? 0) : 0;
  return duree - 5 * st - 4 * angor;
}

export const effort: ModeleExamen = {
  cle: "effort",
  type: "Épreuve d'effort",
  bouton: "Épreuve d'effort",
  titre: "ÉPREUVE D'EFFORT",
  resume: "FMT, double produit, score de Duke, ST, réponse tensionnelle.",
  sections: [
    {
      titre: "Contexte",
      champs: [
        { cle: "ecgRepos", libelle: "ECG de repos", type: "texte", exemple: "rythme sinusal, repolarisation normale" },
        { cle: "betabloquant", libelle: "Bêtabloquant", type: "choix", options: ["non", "oui"] },
      ],
    },
    {
      titre: "Protocole",
      champs: [
        { cle: "type", libelle: "Type d'effort", type: "choix", options: ["tapis roulant", "bicyclette ergométrique"] },
        { cle: "protocole", libelle: "Protocole", type: "texte", exemple: "Bruce, ou 25 W / 2 min" },
        { cle: "duree", libelle: "Durée de l'effort", type: "nombre", unite: "min", min: 1, max: 60 },
        { cle: "puissance", libelle: "Puissance maximale", type: "nombre", unite: "W", min: 10, max: 500 },
        { cle: "mets", libelle: "Dépense énergétique", type: "nombre", unite: "METs", min: 1, max: 25 },
      ],
    },
    {
      titre: "Hémodynamique",
      champs: [
        { cle: "fcRepos", libelle: "FC de repos", type: "nombre", unite: "bpm", min: 30, max: 200 },
        { cle: "fcMax", libelle: "FC maximale", type: "nombre", unite: "bpm", min: 40, max: 260 },
        { cle: "pasRepos", libelle: "PAS de repos", type: "nombre", unite: "mmHg", min: 70, max: 260 },
        { cle: "padRepos", libelle: "PAD de repos", type: "nombre", unite: "mmHg", min: 40, max: 160 },
        { cle: "pasPic", libelle: "PAS à l'effort maximal", type: "nombre", unite: "mmHg", min: 70, max: 350 },
        { cle: "padPic", libelle: "PAD à l'effort maximal", type: "nombre", unite: "mmHg", min: 30, max: 200 },
        { cle: "pasRecup", libelle: "PAS à la récupération", type: "nombre", unite: "mmHg", min: 60, max: 300 },
        { cle: "padRecup", libelle: "PAD à la récupération", type: "nombre", unite: "mmHg", min: 30, max: 200 },
      ],
    },
    {
      titre: "Clinique",
      champs: [
        { cle: "motifArret", libelle: "Motif d'arrêt", type: "choix", options: ARRETS },
        { cle: "angor", libelle: "Douleur thoracique", type: "choix", options: ANGOR },
        { cle: "symptomes", libelle: "Autres symptômes", type: "texte", exemple: "aucun" },
      ],
    },
    {
      titre: "ECG d'effort",
      champs: [
        { cle: "stPente", libelle: "Segment ST", type: "choix", options: PENTES },
        { cle: "stMax", libelle: "Sous-décalage de ST maximal", type: "nombre", unite: "mm", min: 0, max: 10 },
        { cle: "stDerivations", libelle: "Dérivations concernées", type: "texte", exemple: "V4 à V6" },
        { cle: "arythmies", libelle: "Rythme et conduction", type: "texte", exemple: "pas de trouble significatif" },
        { cle: "ecgRecup", libelle: "Récupération", type: "texte", exemple: "pas de modification" },
      ],
    },
  ],
  calculs(v, c) {
    const lignes: string[] = [];
    const f = c.age !== null ? fmt(c.age) : null;
    const fcMax = nombre(v, "fcMax");
    if (f !== null) {
      lignes.push(
        `FMT théorique ${fr(f)} bpm (220 − âge) ; 85 % de la FMT : ${fr(f * 0.85)} bpm` +
          (fcMax !== null ? ` ; FC maximale atteinte : ${fr((fcMax / f) * 100)} % de la FMT` : ""),
      );
    }
    const pasPic = nombre(v, "pasPic");
    if (fcMax !== null && pasPic !== null) lignes.push(`Double produit maximal : ${fr(fcMax * pasPic)}`);
    const d = duke(v);
    if (d !== null) lignes.push(`Score de Duke : ${fr(d, 1)}`);
    return lignes;
  },
  propositions(v, c) {
    const p: Proposition[] = [];
    const ajouter = (texte: string, source: string) => p.push({ texte, source });
    const f = c.age !== null ? fmt(c.age) : null;
    const [fcMax, stMax, pasRepos, pasPic] = ["fcMax", "stMax", "pasRepos", "pasPic"].map((k) => nombre(v, k));
    const pourcent = f !== null && fcMax !== null ? (fcMax / f) * 100 : null;
    const maximal = pourcent !== null ? pourcent >= 85 : null;
    const pente = texte(v, "stPente");
    const angor = texte(v, "angor");

    if (pourcent !== null) {
      ajouter(
        maximal
          ? `Effort maximal (${fr(pourcent)} % de la FMT).`
          : `Effort sous-maximal (${fr(pourcent)} % de la FMT, objectif 85 %).`,
        "Critère usuel : 85 % de la FMT",
      );
      if (!maximal && texte(v, "betabloquant") === "oui") {
        ajouter("FMT non atteinte sous bêtabloquant : interpréter avec prudence.", "Critère usuel");
      }
    }
    const positifST = (pente === "horizontal" || pente === "descendant") && stMax !== null && stMax >= 1;
    if (positifST) {
      ajouter(
        `Sous-décalage de ST ${pente} de ${fr(stMax!, 1)} mm : test électriquement positif.`,
        "ESC 2019 syndromes coronariens chroniques (≥ 0,1 mV)",
      );
    }
    if (angor === "limitant") ajouter("Douleur thoracique limitante à l'effort.", "Score de Duke (indice d'angor)");
    else if (angor === "non limitant") ajouter("Douleur thoracique non limitante à l'effort.", "Score de Duke (indice d'angor)");
    if (maximal !== null && pente && angor && !positifST && angor === "absent") {
      ajouter(
        maximal
          ? "Épreuve d'effort négative : maximale, sans douleur thoracique ni sous-décalage de ST."
          : "Épreuve d'effort non concluante : négative sur les plans clinique et électrique mais sous-maximale.",
        "ESC 2019 syndromes coronariens chroniques",
      );
    }
    const d = duke(v);
    if (d !== null) {
      ajouter(
        d >= 5
          ? `Score de Duke à ${fr(d, 1)} : risque faible.`
          : d >= -10
            ? `Score de Duke à ${fr(d, 1)} : risque intermédiaire.`
            : `Score de Duke à ${fr(d, 1)} : risque élevé.`,
        "Duke (Mark 1987)",
      );
    }
    if (pasPic !== null) {
      const limite = c.sexe === "F" ? 190 : 210;
      if (pasPic >= limite) ajouter(`Réponse tensionnelle exagérée (PAS ${fr(pasPic)} mmHg à l'effort).`, "AHA 2013 épreuve d'effort");
      if (pasRepos !== null && pasPic < pasRepos) {
        ajouter("Chute de la PAS à l'effort (inférieure à la PA de repos) : signe de gravité.", "AHA 2013 épreuve d'effort");
      } else if (pasRepos !== null && pasPic >= pasRepos && pasPic < limite) {
        ajouter("Bonne adaptation tensionnelle à l'effort.", "AHA 2013 épreuve d'effort");
      }
    }
    return p;
  },
  verification:
    "FMT = 220 − âge ; test maximal ≥ 85 % de la FMT ; sous-décalage de ST ≥ 1 mm ; Duke ≥ 5 faible, − 10 à 4 intermédiaire, ≤ − 11 élevé ; PAS d'effort ≥ 210 (homme) ou 190 (femme) mmHg. À relire contre les recommandations avant usage clinique.",
};

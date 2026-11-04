// Pré-remplissage d'un calcul à partir du dossier patient. Le médecin voit chaque valeur reprise, son origine,
// et peut la modifier. Seules les correspondances sûres sont reprises : le reste reste à saisir.
// Module sans accès base, utilisable dans le navigateur.

import type { StatutTabac } from "../mode-de-vie";
import type { Calculateur, Valeurs } from "./types";

export type DonneesDossier = {
  age: number | null;
  sexe: "" | "F" | "M";
  poids: number | null; // fiche patient, à défaut dernière consultation
  taille: number | null;
  fc: number | null;
  creatinine: number | null; // mg/L, dernière valeur saisie en consultation
  facteurs: string[]; // facteurs de risque du dossier (libellés de la fiche)
  tabac: StatutTabac;
  alcoolVerres: number | null; // verres par semaine
  fevg: number | null; // % : mesure la plus récente, à défaut la valeur de base de la fiche
  // D'où viennent ces valeurs, pour l'indiquer à côté du champ
  poidsOrigine?: string;
  tailleOrigine?: string;
  creatinineOrigine?: string;
  fevgOrigine?: string;
};

export type Preremplissage = { valeurs: Valeurs; origines: Record<string, string> };

// Facteurs de la fiche patient correspondant à une case du calcul
const facteurDeCase: Record<string, string> = {
  hta: "HTA",
  diabete: "Diabète",
  tabac: "Tabac",
  obesite: "Obésité",
  irc: "Insuffisance rénale",
};

// Seuils d'âge des cases « Âge » propres à chaque score
const caseAge: Record<string, (age: number) => boolean> = {
  "has-bled": (a) => a > 65,
  "timi-nstemi": (a) => a >= 65,
  spesi: (a) => a > 80,
};

// Option retenue pour un choix « Âge », selon les tranches de chaque score
function trancheAge(slug: string, age: number): string | undefined {
  switch (slug) {
    case "cha2ds2-va":
      return age >= 75 ? "age75" : age >= 65 ? "age65" : "moins65";
    case "hfa-icos-her2":
      return age >= 80 ? "80" : age >= 65 ? "65-79" : "moins65";
    case "cha2ds2-vasc":
      return age >= 75 ? "2" : age >= 65 ? "1" : "0";
    case "heart":
      return age >= 65 ? "2" : age >= 45 ? "1" : "0";
  }
  return undefined;
}

export function preremplir(calculateur: Calculateur, d: DonneesDossier): Preremplissage {
  const valeurs: Valeurs = {};
  const origines: Record<string, string> = {};
  const fixer = (cle: string, valeur: Valeurs[string], origine: string) => {
    valeurs[cle] = valeur;
    origines[cle] = origine;
  };
  const AGE = "âge du dossier";
  const CONSULTATION = "dernière consultation";

  for (const c of calculateur.champs) {
    if (c.type === "nombre") {
      if (c.cle === "age" && d.age !== null) fixer(c.cle, d.age, AGE);
      else if (c.cle === "poids" && d.poids !== null) fixer(c.cle, d.poids, d.poidsOrigine ?? CONSULTATION);
      else if (c.cle === "taille" && d.taille !== null) fixer(c.cle, d.taille, d.tailleOrigine ?? CONSULTATION);
      else if (c.cle === "fc" && d.fc !== null) fixer(c.cle, d.fc, CONSULTATION);
      else if (c.cle === "creatinine" && d.creatinine !== null) fixer(c.cle, d.creatinine, d.creatinineOrigine ?? CONSULTATION);
    } else if (c.type === "choix") {
      if (c.cle === "sexe" && d.sexe) fixer(c.cle, d.sexe === "F" ? "F" : "H", "sexe du dossier");
      else if (c.cle === "age" && d.age !== null) {
        const tranche = trancheAge(calculateur.slug, d.age);
        if (tranche && c.options.some((o) => o.valeur === tranche)) fixer(c.cle, tranche, AGE);
      } else if (c.cle === "fevg" && d.fevg !== null) {
        const tranche = d.fevg >= 55 ? "normale" : d.fevg >= 50 ? "limite" : "basse";
        if (c.options.some((o) => o.valeur === tranche)) fixer(c.cle, tranche, d.fevgOrigine ?? "FEVG du dossier");
      }
    } else {
      if (c.cle === "femme" && d.sexe === "F") fixer(c.cle, true, "sexe du dossier");
      else if (c.cle === "age" && d.age !== null && caseAge[calculateur.slug]?.(d.age)) fixer(c.cle, true, AGE);
      else if (c.cle === "tabac" && d.tabac === "actuel") fixer(c.cle, true, "tabagisme de la fiche");
      else if (c.cle === "alcool" && d.alcoolVerres !== null && d.alcoolVerres >= 8)
        fixer(c.cle, true, `alcool de la fiche : ${d.alcoolVerres} verres par semaine`);
      else {
        const facteur = facteurDeCase[c.cle];
        if (facteur && d.facteurs.includes(facteur)) fixer(c.cle, true, `facteur de risque : ${facteur}`);
      }
    }
  }
  return { valeurs, origines };
}

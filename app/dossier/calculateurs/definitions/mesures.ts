import { dfg, imc, surfaceCorporelle } from "../../calculs";
import { nombre, type Calculateur } from "../types";

const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
const manquant = { score: null, libelle: "Renseigner les valeurs", gravite: "neutre" as const };
const VERIFICATION =
  "Formules classiques. Les seuils sont à relire contre les recommandations avant usage clinique.";

// Intervalle QT corrigé par la formule de Bazett et par celle de Fridericia
export const qtc: Calculateur = {
  slug: "qtc",
  titre: "QT corrigé (Bazett, Fridericia)",
  resume: "QT corrigé de la fréquence cardiaque, à partir de l'ECG.",
  specialite: "cardiologie",
  champs: [
    { type: "nombre", cle: "qt", libelle: "QT mesuré", unite: "ms" },
    { type: "nombre", cle: "fc", libelle: "Fréquence cardiaque", unite: "bpm" },
    {
      type: "choix",
      cle: "sexe",
      libelle: "Sexe",
      options: [
        { valeur: "H", libelle: "Homme" },
        { valeur: "F", libelle: "Femme" },
      ],
    },
  ],
  evaluer(valeurs) {
    const qt = nombre(valeurs, "qt");
    const fc = nombre(valeurs, "fc");
    if (!qt || !fc || qt <= 0 || fc <= 0) return manquant;
    const rr = 60 / fc; // secondes
    const bazett = qt / Math.sqrt(rr);
    const fridericia = qt / Math.cbrt(rr);
    const seuil = valeurs.sexe === "F" ? 480 : 470;
    const reference = fridericia;
    const gravite = reference >= 500 ? "tres-eleve" : reference >= seuil ? "eleve" : "faible";
    return {
      score: null,
      libelle: `Bazett ${fr(bazett)} ms · Fridericia ${fr(fridericia)} ms`,
      gravite,
      recommandation:
        reference >= 500
          ? "QTc ≥ 500 ms : risque élevé de torsades de pointes."
          : reference >= seuil
            ? `QTc allongé (seuil ${seuil} ms) d'après Fridericia.`
            : "QTc non allongé d'après Fridericia. Bazett surestime l'allongement aux fréquences élevées.",
    };
  },
  notes: ["Seuils d'allongement : 470 ms chez l'homme et 480 ms chez la femme (ESC)."],
  source: { libelle: "Bazett 1920 ; Fridericia 1920" },
  verification: VERIFICATION,
};

// LDL-cholestérol calculé (Friedewald), en g/L
export const friedewald: Calculateur = {
  slug: "ldl-friedewald",
  titre: "LDL-cholestérol (Friedewald)",
  resume: "LDL calculé à partir du bilan lipidique, en g/L.",
  specialite: "biologie",
  champs: [
    { type: "nombre", cle: "ct", libelle: "Cholestérol total", unite: "g/L" },
    { type: "nombre", cle: "hdl", libelle: "HDL-cholestérol", unite: "g/L" },
    { type: "nombre", cle: "tg", libelle: "Triglycérides", unite: "g/L" },
  ],
  evaluer(valeurs) {
    const ct = nombre(valeurs, "ct");
    const hdl = nombre(valeurs, "hdl");
    const tg = nombre(valeurs, "tg");
    if (ct === undefined || hdl === undefined || tg === undefined) return manquant;
    if (tg > 3.5)
      return { score: null, libelle: "Non valable : triglycérides > 3,5 g/L", gravite: "neutre", recommandation: "Doser le LDL directement." };
    const ldl = ct - hdl - tg / 5;
    return { score: null, libelle: `LDL-cholestérol ${ldl.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} g/L`, gravite: "neutre" };
  },
  notes: ["LDL = CT − HDL − TG/5 (g/L). Non valable au-delà de 3,5 g/L de triglycérides."],
  source: { libelle: "Friedewald WT et al., Clin Chem 1972" },
  verification: VERIFICATION,
};

export const imcCalculateur: Calculateur = {
  slug: "imc-surface",
  titre: "IMC et surface corporelle",
  resume: "Indice de masse corporelle et surface corporelle (Mosteller).",
  specialite: "cardiologie",
  champs: [
    { type: "nombre", cle: "poids", libelle: "Poids", unite: "kg" },
    { type: "nombre", cle: "taille", libelle: "Taille", unite: "cm" },
  ],
  evaluer(valeurs) {
    const i = imc(nombre(valeurs, "poids") ?? null, nombre(valeurs, "taille") ?? null);
    const s = surfaceCorporelle(nombre(valeurs, "poids") ?? null, nombre(valeurs, "taille") ?? null);
    if (i === null || s === null) return manquant;
    return {
      score: null,
      libelle: `IMC ${fr(i, 1)} kg/m² · surface corporelle ${fr(s, 2)} m²`,
      gravite: i >= 30 ? "moyen" : "neutre",
    };
  },
  notes: ["Mêmes formules que la fiche patient (calculs.ts)."],
  source: { libelle: "Mosteller RD, N Engl J Med 1987" },
  verification: VERIFICATION,
};

// DFG estimé par CKD-EPI 2021 (même formule que la fiche patient, créatinine en mg/L)
export const dfgCkdEpi: Calculateur = {
  slug: "dfg-ckd-epi",
  titre: "DFG (CKD-EPI 2021)",
  resume: "Débit de filtration glomérulaire estimé, sans coefficient ethnique.",
  specialite: "biologie",
  champs: [
    { type: "nombre", cle: "creatinine", libelle: "Créatininémie", unite: "mg/L" },
    { type: "nombre", cle: "age", libelle: "Âge", unite: "ans" },
    {
      type: "choix",
      cle: "sexe",
      libelle: "Sexe",
      options: [
        { valeur: "H", libelle: "Homme" },
        { valeur: "F", libelle: "Femme" },
      ],
    },
  ],
  evaluer(valeurs) {
    const sexe = valeurs.sexe === "F" ? "F" : "M";
    const d = dfg(nombre(valeurs, "creatinine") ?? null, nombre(valeurs, "age") ?? null, sexe);
    if (d === null) return manquant;
    const stade = d >= 90 ? "G1" : d >= 60 ? "G2" : d >= 45 ? "G3a" : d >= 30 ? "G3b" : d >= 15 ? "G4" : "G5";
    return {
      score: null,
      libelle: `DFG ${fr(d)} mL/min/1,73 m² · stade ${stade}`,
      gravite: d >= 60 ? "faible" : d >= 30 ? "moyen" : "eleve",
      recommandation: d < 60 ? "Adapter les posologies et rechercher une atteinte rénale chronique." : undefined,
    };
  },
  notes: ["Créatinine en mg/L (1 mg/dL = 10 mg/L). Stades KDIGO, à confirmer sur 3 mois et l'albuminurie."],
  source: { libelle: "Inker LA et al., N Engl J Med 2021 (CKD-EPI 2021)", url: "https://doi.org/10.1056/NEJMoa2102953" },
  verification: VERIFICATION,
};

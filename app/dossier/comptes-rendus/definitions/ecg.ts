import { fr, nombre, texte, type ModeleExamen, type Proposition } from "../types";

const RYTHMES = [
  "sinusal régulier",
  "sinusal avec extrasystoles",
  "fibrillation atriale",
  "flutter atrial",
  "jonctionnel",
  "électro-entraîné",
  "autre",
];

// Fréquence corrigée du QT (Fridericia et Bazett), comme dans le calculateur QTc du site
export function qtCorrige(qt: number, fc: number) {
  const rr = 60 / fc;
  return { bazett: qt / Math.sqrt(rr), fridericia: qt / Math.cbrt(rr) };
}

export const ecg: ModeleExamen = {
  cle: "ecg",
  type: "ECG",
  bouton: "ECG",
  titre: "ÉLECTROCARDIOGRAMME DE REPOS",
  resume: "Rythme, intervalles, axe, repolarisation, QT corrigé.",
  sections: [
    {
      titre: "Tracé",
      champs: [
        { cle: "rythme", libelle: "Rythme", type: "choix", options: RYTHMES },
        { cle: "fc", libelle: "Fréquence cardiaque", type: "nombre", unite: "bpm", min: 20, max: 300 },
        { cle: "axe", libelle: "Axe du QRS", type: "nombre", unite: "°", min: -180, max: 180, exemple: "60" },
        { cle: "pr", libelle: "PR", type: "nombre", unite: "ms", min: 80, max: 600 },
        { cle: "qrs", libelle: "QRS", type: "nombre", unite: "ms", min: 40, max: 250 },
        { cle: "qt", libelle: "QT", type: "nombre", unite: "ms", min: 200, max: 700 },
      ],
    },
    {
      titre: "Analyse",
      champs: [
        { cle: "ondeP", libelle: "Onde P", type: "texte", exemple: "normale" },
        { cle: "conduction", libelle: "Conduction", type: "texte", exemple: "pas de bloc" },
        { cle: "hypertrophie", libelle: "Hypertrophie", type: "texte", exemple: "absente" },
        { cle: "ondeQ", libelle: "Ondes Q", type: "texte", exemple: "pas d'onde Q pathologique" },
        { cle: "repolarisation", libelle: "Segment ST et onde T", type: "texte", exemple: "repolarisation normale" },
        { cle: "comparaison", libelle: "Comparaison avec le tracé antérieur", type: "texte", exemple: "inchangé" },
      ],
    },
  ],
  calculs(v) {
    const [qt, fc] = [nombre(v, "qt"), nombre(v, "fc")];
    if (qt === null || fc === null) return [];
    const q = qtCorrige(qt, fc);
    return [`QTc Fridericia ${fr(q.fridericia)} ms ; QTc Bazett ${fr(q.bazett)} ms`];
  },
  propositions(v, c) {
    const p: Proposition[] = [];
    const ajouter = (texte: string, source: string) => p.push({ texte, source });
    const rythme = texte(v, "rythme");
    const [fc, pr, qrs, qt, axe] = ["fc", "pr", "qrs", "qt", "axe"].map((k) => nombre(v, k));

    if (rythme && fc !== null) {
      if (rythme.startsWith("sinusal")) {
        if (fc < 60) ajouter(`Bradycardie sinusale (${fr(fc)} bpm).`, "AHA/ACCF/HRS 2009");
        else if (fc > 100) ajouter(`Tachycardie sinusale (${fr(fc)} bpm).`, "AHA/ACCF/HRS 2009");
        else ajouter(`Rythme sinusal régulier à ${fr(fc)} bpm.`, "AHA/ACCF/HRS 2009");
      } else if (rythme === "fibrillation atriale") {
        ajouter(
          fc > 110
            ? `Fibrillation atriale à réponse ventriculaire rapide (${fr(fc)} bpm).`
            : `Fibrillation atriale à ${fr(fc)} bpm.`,
          "ESC 2020 fibrillation atriale",
        );
      } else if (rythme === "flutter atrial") ajouter(`Flutter atrial à ${fr(fc)} bpm.`, "Critère usuel");
    }
    if (pr !== null) {
      if (pr > 200) ajouter(`Bloc auriculo-ventriculaire du 1er degré (PR ${fr(pr)} ms).`, "ESC 2021 stimulation cardiaque");
      else if (pr < 120) ajouter(`PR court (${fr(pr)} ms) : rechercher une préexcitation.`, "AHA/ACCF/HRS 2009");
    }
    if (qrs !== null) {
      if (qrs >= 120) {
        ajouter(
          `QRS élargis (${fr(qrs)} ms) : bloc de branche complet ou trouble de conduction intraventriculaire, à préciser (gauche, droit).`,
          "AHA/ACCF/HRS 2009",
        );
      } else if (qrs >= 110) ajouter(`QRS limites (${fr(qrs)} ms) : bloc de branche incomplet possible.`, "AHA/ACCF/HRS 2009");
    }
    if (qt !== null && fc !== null) {
      const { fridericia } = qtCorrige(qt, fc);
      const seuil = c.sexe === "F" ? 480 : 470;
      if (fridericia >= 500) ajouter(`QTc allongé (${fr(fridericia)} ms) : risque élevé de torsades de pointes.`, "ESC (seuil 500 ms)");
      else if (fridericia >= seuil) ajouter(`QTc allongé (${fr(fridericia)} ms, Fridericia).`, `ESC (seuil ${seuil} ms)`);
      else ajouter(`QTc normal (${fr(fridericia)} ms, Fridericia).`, `ESC (seuil ${seuil} ms)`);
    }
    if (axe !== null) {
      if (axe < -30) ajouter(`Déviation axiale gauche (${fr(axe)}°).`, "AHA/ACCF/HRS 2009");
      else if (axe > 90) ajouter(`Déviation axiale droite (${fr(axe)}°).`, "AHA/ACCF/HRS 2009");
    }
    return p;
  },
  verification:
    "Seuils classiques (AHA/ACCF/HRS 2009 ; ESC) repris dans le calculateur QTc du site. À relire contre les recommandations avant usage clinique.",
};

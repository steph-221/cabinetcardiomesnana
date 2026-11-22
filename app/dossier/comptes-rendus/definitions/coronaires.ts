import { fr, nombre, texte, type ChampExamen, type ModeleExamen, type Proposition, type ValeursExamen } from "../types";

// Sténose par artère, en catégories (CAD-RADS) : le même choix sert au coroscanner et à la coronarographie
const STENOSES = [
  "pas de sténose",
  "minime (1 à 24 %)",
  "légère (25 à 49 %)",
  "modérée (50 à 69 %)",
  "sévère (70 à 99 %)",
  "occlusion (100 %)",
  "non évaluable",
];
const DOMINANCES = ["droite", "gauche", "co-dominance"];
const ARTERES = [
  { cle: "tc", nom: "Tronc commun gauche" },
  { cle: "iva", nom: "Interventriculaire antérieure (IVA)" },
  { cle: "cx", nom: "Circonflexe" },
  { cle: "cd", nom: "Coronaire droite" },
];

// Rang de la sténose : 0 aucune, 1 minime, 2 légère, 3 modérée (50-69 %), 4 sévère (70-99 %), 5 occlusion
const rang = (v: ValeursExamen, cle: string) => {
  const i = STENOSES.indexOf(texte(v, cle));
  return i >= 0 && i <= 5 ? i : null;
};

const champsArteres: ChampExamen[] = ARTERES.map((a) => ({
  cle: a.cle,
  libelle: a.nom,
  type: "choix",
  options: STENOSES,
}));

// Atteinte coronaire : sténoses ≥ 70 % des trois artères principales, tronc commun ≥ 50 %, occlusions
function atteinte(v: ValeursExamen) {
  const principales = ["iva", "cx", "cd"];
  const rangs = principales.map((c) => rang(v, c));
  return {
    renseigne: ARTERES.some((a) => rang(v, a.cle) !== null),
    nonEvaluables: ARTERES.filter((a) => texte(v, a.cle) === "non évaluable").map((a) => a.nom),
    tronc: rang(v, "tc") ?? 0,
    severes: rangs.filter((r) => r !== null && r >= 4).length,
    occlusions: rangs.filter((r) => r === 5).length + (rang(v, "tc") === 5 ? 1 : 0),
    maxi: Math.max(0, rang(v, "tc") ?? 0, ...rangs.map((r) => r ?? 0)),
  };
}

// CAD-RADS 2.0 : 0 aucune sténose ni plaque ; 1 minime ; 2 légère ; 3 modérée ; 4A sévère (1 ou 2 artères) ;
// 4B tronc commun ≥ 50 % ou trois artères ≥ 70 % ; 5 occlusion
export function cadRads(v: ValeursExamen): string | null {
  const a = atteinte(v);
  if (!a.renseigne) return null;
  if (a.occlusions > 0) return "5";
  if (a.tronc >= 3 || a.severes >= 3) return "4B";
  if (a.severes >= 1 || a.tronc >= 4) return "4A";
  if (a.maxi === 3) return "3";
  if (a.maxi === 2) return "2";
  if (a.maxi === 1 || (nombre(v, "agatston") ?? 0) > 0) return "1";
  return "0";
}

// Charge de plaque d'après le score calcique d'Agatston (CAD-RADS 2.0, tableau 1) : P1 de 1 à 100, P2 de 101 à 300,
// P3 de 301 à 999, P4 à partir de 1000 (le texte écrit « > 1000 » : la valeur 1000 exacte n'est pas couverte)
export const chargePlaque = (agatston: number) =>
  agatston <= 0 ? null : agatston <= 100 ? "P1" : agatston <= 300 ? "P2" : agatston < 1000 ? "P3" : "P4";
const LIBELLE_PLAQUE: Record<string, string> = { P1: "légère", P2: "modérée", P3: "sévère", P4: "extensive" };

const CONDUITE: Record<string, string> = {
  "0": "Pas de maladie coronaire athéromateuse visible (CAD-RADS 0).",
  "1": "Sténose minime ou plaque sans sténose significative (CAD-RADS 1) : à discuter, prévention et contrôle des facteurs de risque.",
  "2": "Sténose légère de 25 à 49 % (CAD-RADS 2) : à discuter, prévention et contrôle des facteurs de risque.",
  "3": "Sténose modérée de 50 à 69 % (CAD-RADS 3) : à discuter, test fonctionnel (FFR-CT, imagerie de perfusion) et prévention.",
  "4A": "Sténose sévère de 70 à 99 % sur une ou deux artères (CAD-RADS 4A) : à discuter, test fonctionnel ou coronarographie.",
  "4B": "Sténose du tronc commun d'au moins 50 % ou atteinte des trois artères d'au moins 70 % (CAD-RADS 4B) : coronarographie recommandée.",
  "5": "Occlusion coronaire complète (CAD-RADS 5) : à discuter, coronarographie et recherche de viabilité.",
};

// --- Coroscanner ---

export const coroscanner: ModeleExamen = {
  cle: "coroscanner",
  type: "Coroscanner",
  bouton: "Coroscanner",
  titre: "COROSCANNER (ANGIOSCANNER CORONAIRE)",
  resume: "Score calcique, sténose par artère, CAD-RADS, conduite à discuter.",
  sections: [
    {
      titre: "Acquisition",
      champs: [
        { cle: "fc", libelle: "Fréquence cardiaque", type: "nombre", unite: "bpm", min: 30, max: 200 },
        { cle: "qualite", libelle: "Qualité de l'examen", type: "choix", options: ["bonne", "moyenne", "médiocre"] },
        { cle: "agatston", libelle: "Score calcique d'Agatston", type: "nombre", min: 0, max: 20000 },
        { cle: "dominance", libelle: "Dominance", type: "choix", options: DOMINANCES },
      ],
    },
    { titre: "Sténoses coronaires", champs: champsArteres },
    {
      titre: "Détail",
      champs: [
        { cle: "detail", libelle: "Siège et nature des plaques", type: "texte", exemple: "plaque mixte IVA moyenne, 60 %" },
        { cle: "anomalies", libelle: "Anomalie d'origine ou de trajet, pontages, stents", type: "texte", exemple: "absente" },
        { cle: "extra", libelle: "Anomalies cardiaques et thoraciques", type: "texte", exemple: "pas d'anomalie" },
      ],
    },
  ],
  calculs(v) {
    const lignes: string[] = [];
    const agatston = nombre(v, "agatston");
    if (agatston !== null) {
      const plaque = chargePlaque(agatston);
      lignes.push(`Score calcique ${fr(agatston)}${plaque ? ` (charge de plaque ${plaque})` : ""}`);
    }
    const c = cadRads(v);
    if (c !== null) {
      const a = atteinte(v);
      lignes.push(
        `CAD-RADS ${c}` + (a.nonEvaluables.length ? ` provisoire (non évaluable : ${a.nonEvaluables.join(", ")})` : ""),
      );
    }
    return lignes;
  },
  propositions(v) {
    const p: Proposition[] = [];
    const SOURCE = "CAD-RADS 2.0 (SCCT, ACR, ACC, NASCI 2022)";
    const agatston = nombre(v, "agatston");
    if (texte(v, "qualite") === "médiocre") {
      p.push({ texte: "Qualité de l'examen médiocre : analyse limitée, à interpréter avec prudence.", source: "Critère usuel" });
    }
    if (agatston !== null) {
      const plaque = chargePlaque(agatston);
      p.push({
        texte: plaque
          ? `Score calcique à ${fr(agatston)} : charge de plaque ${LIBELLE_PLAQUE[plaque]} (${plaque}).`
          : "Score calcique nul.",
        source: SOURCE,
      });
    }
    const c = cadRads(v);
    if (c !== null) {
      const a = atteinte(v);
      p.push({
        texte: CONDUITE[c] + (a.nonEvaluables.length ? ` Segments non évaluables : ${a.nonEvaluables.join(", ")}.` : ""),
        source: SOURCE,
      });
    }
    if (texte(v, "dominance")) p.push({ texte: `Circulation coronaire à dominance ${texte(v, "dominance")}.`, source: "Critère usuel" });
    return p;
  },
  verification:
    "CAD-RADS 2.0 (0, 1 à 24 %, 25 à 49 %, 50 à 69 %, 70 à 99 %, occlusion ; 4B : tronc commun ≥ 50 % ou trois artères ≥ 70 %) et catégories de score calcique (0, 1 à 99, 100 à 299, ≥ 300). La classification est calculée d'après les catégories choisies, pas les mesures. À relire contre les recommandations avant usage clinique.",
};

// --- Coronarographie ---

export const coronarographie: ModeleExamen = {
  cle: "coronarographie",
  type: "Coronarographie",
  bouton: "Coronarographie",
  titre: "CORONAROGRAPHIE",
  resume: "Sténoses par artère, nombre d'artères atteintes, FFR, ventriculographie, geste réalisé.",
  sections: [
    {
      titre: "Technique",
      champs: [
        { cle: "voie", libelle: "Voie d'abord", type: "choix", options: ["radiale droite", "radiale gauche", "fémorale"] },
        { cle: "dominance", libelle: "Dominance", type: "choix", options: DOMINANCES },
      ],
    },
    { titre: "Réseau coronaire", champs: champsArteres },
    {
      titre: "Détail et mesure fonctionnelle",
      champs: [
        { cle: "detail", libelle: "Siège des lésions", type: "texte", exemple: "IVA moyenne, bifurcation, calcifiée" },
        { cle: "pontages", libelle: "Pontages, stents antérieurs", type: "texte", exemple: "absents" },
        { cle: "ffr", libelle: "FFR", type: "nombre", min: 0.3, max: 1 },
        { cle: "ifr", libelle: "iFR", type: "nombre", min: 0.3, max: 1 },
      ],
    },
    {
      titre: "Ventriculographie",
      champs: [
        { cle: "fevg", libelle: "FEVG", type: "nombre", unite: "%", min: 5, max: 90 },
        { cle: "cinetique", libelle: "Cinétique", type: "texte", exemple: "normale" },
        { cle: "ptdvg", libelle: "Pression télédiastolique du VG", type: "nombre", unite: "mmHg", min: 0, max: 60 },
      ],
    },
    {
      titre: "Geste et suites",
      champs: [
        {
          cle: "geste",
          libelle: "Geste réalisé",
          type: "choix",
          options: ["aucun", "angioplastie avec stent actif", "angioplastie au ballon", "thrombo-aspiration", "autre"],
        },
        { cle: "detailGeste", libelle: "Détail du geste (artère, stent, longueur, diamètre)", type: "texte" },
        { cle: "complications", libelle: "Complications", type: "texte", exemple: "aucune" },
      ],
    },
  ],
  calculs(v) {
    const lignes: string[] = [];
    const a = atteinte(v);
    if (a.renseigne) {
      const tronc = a.tronc >= 3 ? "tronc commun ≥ 50 %" : "";
      lignes.push(
        `Artères avec sténose ≥ 70 % : ${a.severes} sur 3` + (tronc ? ` ; ${tronc}` : "") + (a.nonEvaluables.length ? ` ; non évaluable : ${a.nonEvaluables.join(", ")}` : ""),
      );
    }
    return lignes;
  },
  propositions(v) {
    const p: Proposition[] = [];
    const ajouter = (texte: string, source: string) => p.push({ texte, source });
    const SOURCE = "ESC/EACTS 2018 revascularisation myocardique";
    const a = atteinte(v);
    if (a.renseigne) {
      if (a.tronc >= 3) {
        ajouter("Sténose significative du tronc commun gauche (≥ 50 %) : à discuter, avis de l'équipe cardiologique (revascularisation).", SOURCE);
      }
      if (a.occlusions > 0) ajouter(`Occlusion coronaire complète (${a.occlusions} artère${a.occlusions > 1 ? "s" : ""}).`, "Critère usuel");
      if (a.severes >= 3) ajouter("Atteinte tritronculaire (trois artères avec sténose ≥ 70 %) : à discuter, avis de l'équipe cardiologique.", SOURCE);
      else if (a.severes === 2) ajouter("Atteinte bitronculaire (deux artères avec sténose ≥ 70 %).", SOURCE);
      else if (a.severes === 1) ajouter("Atteinte monotronculaire (sténose ≥ 70 % sur une artère).", SOURCE);
      if (a.tronc < 3 && a.severes === 0 && a.occlusions === 0) {
        ajouter(
          a.maxi === 3
            ? "Sténose intermédiaire de 50 à 69 % : à discuter, évaluation fonctionnelle (FFR, iFR)."
            : a.maxi >= 1
              ? "Lésions athéromateuses non significatives (< 50 %)."
              : "Coronaires angiographiquement normales.",
          SOURCE,
        );
      }
      if (a.nonEvaluables.length) ajouter(`Artère non évaluable : ${a.nonEvaluables.join(", ")}.`, "Critère usuel");
    }
    const [ffr, ifr] = [nombre(v, "ffr"), nombre(v, "ifr")];
    if (ffr !== null) {
      ajouter(
        ffr <= 0.8 ? `FFR à ${fr(ffr, 2)} : sténose hémodynamiquement significative (seuil 0,80).` : `FFR à ${fr(ffr, 2)} : sténose non significative sur le plan hémodynamique.`,
        SOURCE,
      );
    }
    if (ifr !== null) {
      ajouter(
        ifr <= 0.89 ? `iFR à ${fr(ifr, 2)} : sténose hémodynamiquement significative (seuil 0,89).` : `iFR à ${fr(ifr, 2)} : sténose non significative sur le plan hémodynamique.`,
        SOURCE,
      );
    }
    const fevg = nombre(v, "fevg");
    if (fevg !== null) {
      ajouter(
        fevg >= 50
          ? `Fonction systolique du ventricule gauche conservée (FEVG ${fr(fevg)} %).`
          : fevg >= 41
            ? `FEVG modérément altérée à ${fr(fevg)} %.`
            : `Altération de la fonction systolique du ventricule gauche (FEVG ${fr(fevg)} %).`,
        "ESC 2021 insuffisance cardiaque",
      );
    }
    const geste = texte(v, "geste");
    if (geste && geste !== "aucun") {
      ajouter(`${geste[0].toUpperCase()}${geste.slice(1)}${texte(v, "detailGeste") ? ` : ${texte(v, "detailGeste")}` : ""}.`, "Compte rendu opératoire");
    }
    if (texte(v, "complications")) ajouter(`Complications : ${texte(v, "complications")}.`, "Compte rendu opératoire");
    return p;
  },
  verification:
    "Sténose significative ≥ 70 % (≥ 50 % pour le tronc commun) ; FFR ≤ 0,80 et iFR ≤ 0,89 (ESC/EACTS 2018). Les catégories de sténose sont choisies par le médecin. À relire contre les recommandations avant usage clinique.",
};

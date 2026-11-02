import { fr, nombre, texte, type ModeleExamen, type Proposition } from "../types";

const RYTHMES = ["sinusal", "fibrillation atriale permanente", "flutter atrial", "électro-entraîné", "autre"];

// Nombre de complexes enregistrés, estimé d'après la fréquence moyenne et la durée
export function nombreComplexes(fcMoy: number, heures: number) {
  return fcMoy * 60 * heures;
}

export const holter: ModeleExamen = {
  cle: "holter",
  type: "Holter ECG",
  bouton: "Holter",
  titre: "ENREGISTREMENT HOLTER ECG",
  resume: "Fréquences, extrasystoles, tachycardies, pauses, fibrillation atriale.",
  sections: [
    {
      titre: "Enregistrement",
      champs: [
        { cle: "traitement", libelle: "Traitement en cours", type: "texte", exemple: "bêtabloquant, antiarythmique" },
        { cle: "duree", libelle: "Durée analysée", type: "nombre", unite: "h", min: 1, max: 168, exemple: "24" },
        { cle: "qualite", libelle: "Qualité du tracé", type: "choix", options: ["bonne", "moyenne", "médiocre"] },
        { cle: "rythme", libelle: "Rythme de base", type: "choix", options: RYTHMES },
      ],
    },
    {
      titre: "Fréquence cardiaque",
      champs: [
        { cle: "fcMin", libelle: "FC minimale", type: "nombre", unite: "bpm", min: 15, max: 200 },
        { cle: "fcMoy", libelle: "FC moyenne", type: "nombre", unite: "bpm", min: 30, max: 200 },
        { cle: "fcMax", libelle: "FC maximale", type: "nombre", unite: "bpm", min: 40, max: 300 },
      ],
    },
    {
      titre: "Arythmies ventriculaires",
      champs: [
        { cle: "nbESV", libelle: "Extrasystoles ventriculaires", type: "nombre", min: 0, max: 300000 },
        { cle: "doublets", libelle: "Doublets", type: "nombre", min: 0, max: 100000 },
        { cle: "salvesTV", libelle: "Salves de tachycardie ventriculaire", type: "nombre", min: 0, max: 10000 },
        { cle: "detailTV", libelle: "Détail des salves (complexes, fréquence)", type: "texte", exemple: "5 complexes à 160 bpm" },
      ],
    },
    {
      titre: "Arythmies supraventriculaires",
      champs: [
        { cle: "nbESSV", libelle: "Extrasystoles supraventriculaires", type: "nombre", min: 0, max: 300000 },
        { cle: "salvesSV", libelle: "Salves supraventriculaires", type: "nombre", min: 0, max: 10000 },
        { cle: "fa", libelle: "Fibrillation atriale", type: "choix", options: ["absente", "paroxystique", "permanente"] },
        { cle: "dureeFA", libelle: "Durée ou charge de FA", type: "texte", exemple: "2 épisodes, 40 min au total" },
      ],
    },
    {
      titre: "Pauses et conduction",
      champs: [
        { cle: "nbPauses", libelle: "Pauses ≥ 3 secondes", type: "nombre", min: 0, max: 5000 },
        { cle: "pauseMax", libelle: "Pause maximale", type: "nombre", unite: "s", min: 0, max: 30 },
        { cle: "conduction", libelle: "Conduction auriculo-ventriculaire", type: "texte", exemple: "pas de bloc" },
      ],
    },
    {
      titre: "Corrélation clinique",
      champs: [
        { cle: "symptomes", libelle: "Symptômes notés dans le journal", type: "texte", exemple: "palpitations à 15 h, sans anomalie" },
      ],
    },
  ],
  calculs(v) {
    const lignes: string[] = [];
    const [duree, fcMoy, esv, essv] = [nombre(v, "duree"), nombre(v, "fcMoy"), nombre(v, "nbESV"), nombre(v, "nbESSV")];
    if (duree !== null && fcMoy !== null) {
      const total = nombreComplexes(fcMoy, duree);
      lignes.push(`Nombre de complexes estimé : ${fr(total)}`);
      if (esv !== null) lignes.push(`Charge d'extrasystoles ventriculaires : ${fr((esv / total) * 100, 1)} % des complexes`);
      if (essv !== null) lignes.push(`Charge d'extrasystoles supraventriculaires : ${fr((essv / total) * 100, 1)} % des complexes`);
    }
    return lignes;
  },
  propositions(v) {
    const p: Proposition[] = [];
    const ajouter = (texte: string, source: string) => p.push({ texte, source });
    const [duree, fcMoy, fcMin, esv, tv, salvesSV, pauseMax, nbPauses] = [
      "duree",
      "fcMoy",
      "fcMin",
      "nbESV",
      "salvesTV",
      "salvesSV",
      "pauseMax",
      "nbPauses",
    ].map((k) => nombre(v, k));
    const fa = texte(v, "fa");
    const rythme = texte(v, "rythme");

    if (texte(v, "qualite") === "médiocre") {
      ajouter("Qualité du tracé médiocre : l'analyse est limitée, à interpréter avec prudence.", "Critère usuel");
    }
    if (fcMin !== null && fcMin < 40) ajouter(`Bradycardie (FC minimale ${fr(fcMin)} bpm), à corréler aux symptômes.`, "ESC 2021 stimulation cardiaque");
    if (fcMoy !== null && fcMoy > 100) ajouter(`FC moyenne élevée (${fr(fcMoy)} bpm).`, "Critère usuel");

    const charge = duree !== null && fcMoy !== null && esv !== null ? (esv / (fcMoy * 60 * duree)) * 100 : null;
    if (charge !== null && charge > 10) {
      ajouter(
        `Charge d'extrasystoles ventriculaires élevée (${fr(charge, 1)} %) : à discuter, recherche d'une cardiopathie sous-jacente et risque de cardiomyopathie induite.`,
        "ESC 2022 arythmies ventriculaires (seuil 10 %)",
      );
    }
    const doublets = nombre(v, "doublets");
    if (doublets !== null && doublets > 0) ajouter(`Doublets d'extrasystoles ventriculaires (${fr(doublets)}).`, "Critère usuel");
    if (tv !== null && tv > 0) {
      ajouter(
        `Tachycardie ventriculaire non soutenue (${fr(tv)} salve${tv > 1 ? "s" : ""})${texte(v, "detailTV") ? ` : ${texte(v, "detailTV")}` : ""} : à discuter, bilan de cardiopathie sous-jacente.`,
        "ESC 2022 arythmies ventriculaires",
      );
    }
    if (salvesSV !== null && salvesSV > 0) ajouter(`Salves de tachycardie supraventriculaire (${fr(salvesSV)}).`, "Critère usuel");
    if (fa === "paroxystique") {
      ajouter(
        "Fibrillation atriale paroxystique documentée : à discuter, évaluation du risque thromboembolique (CHA₂DS₂-VA, calculateur du site) et de l'anticoagulation.",
        "ESC 2024 fibrillation atriale",
      );
    } else if (fa === "permanente" || rythme === "fibrillation atriale permanente") {
      ajouter("Fibrillation atriale permanente sur tout l'enregistrement.", "ESC 2024 fibrillation atriale");
    }
    if ((pauseMax !== null && pauseMax >= 3) || (nbPauses !== null && nbPauses > 0)) {
      ajouter(
        `Pause${pauseMax !== null ? ` maximale de ${fr(pauseMax, 1)} s` : ""} (≥ 3 s) : à corréler aux symptômes et à l'état de veille ou de sommeil.`,
        "ESC 2021 stimulation cardiaque",
      );
    }
    const anormal =
      (charge !== null && charge > 10) ||
      (tv ?? 0) > 0 ||
      (pauseMax ?? 0) >= 3 ||
      (nbPauses ?? 0) > 0 ||
      fa === "paroxystique" ||
      fa === "permanente";
    if (!anormal && esv !== null && fcMin !== null && pauseMax !== null && tv !== null && fa === "absente") {
      ajouter("Pas d'arythmie significative sur l'enregistrement : pas de pause, pas de tachycardie ventriculaire, pas de fibrillation atriale.", "Critère usuel");
    }
    return p;
  },
  verification:
    "Pauses ≥ 3 s (ESC 2021 stimulation) ; charge d'extrasystoles ventriculaires > 10 % (ESC 2022) ; FA paroxystique et CHA₂DS₂-VA (ESC 2024). À relire contre les recommandations avant usage clinique.",
};

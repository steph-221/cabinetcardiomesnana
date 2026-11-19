import { fr, nombre, texte, type ModeleExamen, type Proposition } from "../types";

const COTES = ["droit", "gauche", "bilatéral"];

// --- Doppler veineux des membres inférieurs ---

export const dopplerVeineux: ModeleExamen = {
  cle: "doppler-veineux",
  type: "Doppler vasculaire",
  bouton: "Doppler veineux",
  titre: "COMPTE RENDU D'ÉCHO-DOPPLER VEINEUX DES MEMBRES INFÉRIEURS",
  resume: "Thrombose veineuse profonde, reflux des saphènes, œdème, adénopathie.",
  sections: [
    {
      titre: "Examen",
      champs: [
        { cle: "cote", libelle: "Côté examiné", type: "choix", options: COTES },
        { cle: "segments", libelle: "Segments examinés", type: "texte", exemple: "fémoral commun, fémoral, poplité, jambiers" },
      ],
    },
    {
      titre: "Axes profonds",
      champs: [
        { cle: "compressibilite", libelle: "Compressibilité", type: "choix", options: ["compressible", "non compressible", "compression incomplète"] },
        {
          cle: "thrombose",
          libelle: "Thrombose veineuse",
          type: "choix",
          options: ["absente", "proximale (fémoro-poplitée ou iliaque)", "distale (jambière)", "musculaire (surale)", "superficielle", "non concluant"],
        },
        { cle: "flux", libelle: "Flux Doppler", type: "texte", exemple: "normal, phasique" },
        { cle: "siege", libelle: "Siège et extension du thrombus", type: "texte" },
      ],
    },
    {
      titre: "Réseau superficiel",
      champs: [
        { cle: "refluxGVS", libelle: "Reflux de la grande saphène", type: "nombre", unite: "s", min: 0, max: 20 },
        { cle: "refluxPVS", libelle: "Reflux de la petite saphène", type: "nombre", unite: "s", min: 0, max: 20 },
        { cle: "refluxProfond", libelle: "Reflux fémoral ou poplité", type: "nombre", unite: "s", min: 0, max: 20 },
        { cle: "varices", libelle: "Varices", type: "texte", exemple: "absentes" },
      ],
    },
    {
      titre: "Parties molles",
      champs: [
        { cle: "oedeme", libelle: "Œdème", type: "texte", exemple: "jusqu'au genou" },
        { cle: "adenopathie", libelle: "Adénopathie", type: "texte", exemple: "inguinale droite, 15 mm, aspect inflammatoire" },
        { cle: "autres", libelle: "Kyste poplité, hématome, collection", type: "texte", exemple: "absents" },
      ],
    },
  ],
  // Incohérence signalée au médecin (elle n'entre pas dans le « AU TOTAL »)
  calculs(v) {
    return texte(v, "compressibilite") === "non compressible" && texte(v, "thrombose") === "absente"
      ? ["Vérifier : veine non compressible alors que la thrombose est notée absente"]
      : [];
  },
  propositions(v) {
    const p: Proposition[] = [];
    const ajouter = (texte: string, source: string) => p.push({ texte, source });
    const thrombose = texte(v, "thrombose");
    const cote = texte(v, "cote");
    const lieu = cote ? ` du membre inférieur ${cote === "bilatéral" ? "(bilatérale)" : cote}` : "";
    if (thrombose === "absente") {
      ajouter(
        `Pas de thrombose veineuse profonde${lieu} sur les segments examinés${texte(v, "segments") ? ` (${texte(v, "segments")})` : ""}.`,
        "Critère usuel (compressibilité)",
      );
    } else if (thrombose.startsWith("proximale")) {
      ajouter(`Thrombose veineuse profonde proximale${lieu} : à discuter, anticoagulation et prise en charge urgente.`, "ESC 2019 embolie pulmonaire");
    } else if (thrombose.startsWith("distale")) {
      ajouter(`Thrombose veineuse profonde distale (jambière)${lieu} : à discuter, anticoagulation ou surveillance échographique.`, "ESVS 2021 thrombose veineuse");
    } else if (thrombose.startsWith("musculaire")) {
      ajouter(`Thrombose veineuse musculaire (surale)${lieu} : à discuter, traitement selon les symptômes et les facteurs de risque.`, "ESVS 2021 thrombose veineuse");
    } else if (thrombose === "superficielle") {
      ajouter(`Thrombose veineuse superficielle${lieu} : à discuter, mesurer la distance à la jonction saphéno-fémorale.`, "ESVS 2021 thrombose veineuse");
    } else if (thrombose === "non concluant") {
      ajouter("Examen non concluant : à discuter, contrôle échographique ou autre imagerie.", "Critère usuel");
    }
    const [gvs, pvs, profond] = ["refluxGVS", "refluxPVS", "refluxProfond"].map((k) => nombre(v, k));
    if (gvs !== null && gvs > 0.5) ajouter(`Reflux de la grande saphène (${fr(gvs, 1)} s, seuil 0,5 s) : insuffisance veineuse superficielle.`, "ESVS 2022 maladie veineuse chronique");
    if (pvs !== null && pvs > 0.5) ajouter(`Reflux de la petite saphène (${fr(pvs, 1)} s, seuil 0,5 s) : insuffisance veineuse superficielle.`, "ESVS 2022 maladie veineuse chronique");
    if (profond !== null && profond > 1) ajouter(`Reflux veineux profond (${fr(profond, 1)} s, seuil 1 s).`, "ESVS 2022 maladie veineuse chronique");
    if (
      (gvs === null || gvs <= 0.5) &&
      (pvs === null || pvs <= 0.5) &&
      (profond === null || profond <= 1) &&
      (gvs !== null || pvs !== null || profond !== null)
    ) {
      ajouter("Pas de signe d'insuffisance veineuse.", "ESVS 2022 maladie veineuse chronique");
    }
    if (texte(v, "adenopathie")) {
      ajouter("Adénopathie associée : à discuter, cause infectieuse (érysipèle, lymphangite) ; exploration si elle persiste après traitement.", "Critère usuel");
    }
    return p;
  },
  verification:
    "Reflux pathologique > 0,5 s (superficiel) et > 1 s (fémoral, poplité) ; diagnostic par compressibilité (ESVS 2021 et 2022, ESC 2019). À relire contre les recommandations avant usage clinique.",
};

// --- Doppler artériel des membres inférieurs : index de pression systolique (IPS) ---

export const ips = (cheville: number | null, bras: number | null) =>
  cheville !== null && bras !== null && bras > 0 ? cheville / bras : null;

const libelleIps = (valeur: number) =>
  valeur > 1.4
    ? "artères incompressibles (calcifiées) : IPS non interprétable, mesurer l'index d'orteil"
    : valeur >= 1
      ? "normal"
      : valeur > 0.9
        ? "limite"
        : valeur >= 0.7
          ? "artériopathie oblitérante des membres inférieurs, légère à modérée"
          : valeur >= 0.4
            ? "artériopathie oblitérante des membres inférieurs, modérée à sévère"
            : "artériopathie oblitérante sévère (ischémie critique possible)";

// PAS la plus haute de la cheville (tibiale postérieure ou pédieuse) sur la PAS brassard la plus haute
function ipsCote(v: Record<string, string | number>, cote: "D" | "G") {
  const cheville = Math.max(nombre(v, `pasTibiale${cote}`) ?? 0, nombre(v, `pasPedieuse${cote}`) ?? 0) || null;
  return ips(cheville, nombre(v, "pasBras"));
}

export const dopplerArteriel: ModeleExamen = {
  cle: "doppler-arteriel",
  type: "Doppler vasculaire",
  bouton: "Doppler artériel MI",
  titre: "COMPTE RENDU D'ÉCHO-DOPPLER ARTÉRIEL DES MEMBRES INFÉRIEURS",
  resume: "Index de pression systolique, sténoses, flux, plaques.",
  sections: [
    {
      titre: "Pressions systoliques",
      champs: [
        { cle: "pasBras", libelle: "PAS brachiale la plus haute", type: "nombre", unite: "mmHg", min: 60, max: 300 },
        { cle: "pasTibialeD", libelle: "PAS tibiale postérieure droite", type: "nombre", unite: "mmHg", min: 0, max: 350 },
        { cle: "pasPedieuseD", libelle: "PAS pédieuse droite", type: "nombre", unite: "mmHg", min: 0, max: 350 },
        { cle: "pasTibialeG", libelle: "PAS tibiale postérieure gauche", type: "nombre", unite: "mmHg", min: 0, max: 350 },
        { cle: "pasPedieuseG", libelle: "PAS pédieuse gauche", type: "nombre", unite: "mmHg", min: 0, max: 350 },
      ],
    },
    {
      titre: "Axes artériels",
      champs: [
        { cle: "axeD", libelle: "Membre inférieur droit", type: "texte", exemple: "plaque fémorale superficielle, sténose 50 %" },
        { cle: "axeG", libelle: "Membre inférieur gauche", type: "texte", exemple: "axes perméables, flux triphasique" },
        { cle: "flux", libelle: "Aspect des flux", type: "texte", exemple: "triphasique, biphasique, monophasique" },
        { cle: "anevrisme", libelle: "Anévrisme, calcifications", type: "texte", exemple: "absents" },
      ],
    },
  ],
  calculs(v) {
    const [d, g] = [ipsCote(v, "D"), ipsCote(v, "G")];
    const lignes: string[] = [];
    if (d !== null) lignes.push(`IPS droit : ${fr(d, 2)}`);
    if (g !== null) lignes.push(`IPS gauche : ${fr(g, 2)}`);
    return lignes;
  },
  propositions(v) {
    const p: Proposition[] = [];
    for (const [cote, nom] of [["D", "droit"], ["G", "gauche"]] as const) {
      const valeur = ipsCote(v, cote);
      if (valeur !== null) {
        p.push({
          texte: `IPS ${nom} à ${fr(valeur, 2)} : ${libelleIps(valeur)}.`,
          source: "ESC 2024 artériopathie périphérique (IPS ≤ 0,90 ; > 1,40 incompressible)",
        });
      }
    }
    return p;
  },
  verification:
    "IPS ≤ 0,90 anormal, 0,91 à 0,99 limite, > 1,40 incompressible (ESC 2017 et 2024) ; les gravités par paliers sont indicatives. À relire contre les recommandations avant usage clinique.",
};

// --- Doppler des troncs supra-aortiques (carotides et vertébrales) ---

// Vitesse systolique maximale de l'ACI : estimation de la sténose (consensus SRU)
const stenose = (psv: number) =>
  psv > 230 ? "sténose ≥ 70 %" : psv >= 125 ? "sténose de 50 à 69 %" : "sténose < 50 %";

export const dopplerTSA: ModeleExamen = {
  cle: "doppler-tsa",
  type: "Doppler vasculaire",
  bouton: "Doppler TSA",
  titre: "COMPTE RENDU D'ÉCHO-DOPPLER DES TRONCS SUPRA-AORTIQUES",
  resume: "Carotides, vertébrales, épaisseur intima-média, sténose par la vitesse systolique.",
  sections: [
    {
      titre: "Carotides",
      champs: [
        { cle: "epaisseur", libelle: "Épaisseur intima-média", type: "nombre", unite: "mm", min: 0.3, max: 3 },
        { cle: "plaqueD", libelle: "Plaque carotidienne droite", type: "texte", exemple: "absente, ou plaque calcifiée du bulbe" },
        { cle: "plaqueG", libelle: "Plaque carotidienne gauche", type: "texte", exemple: "absente" },
        { cle: "psvD", libelle: "Vitesse systolique maximale ACI droite", type: "nombre", unite: "cm/s", min: 10, max: 600 },
        { cle: "psvG", libelle: "Vitesse systolique maximale ACI gauche", type: "nombre", unite: "cm/s", min: 10, max: 600 },
      ],
    },
    {
      titre: "Vertébrales et sous-clavières",
      champs: [
        { cle: "vertebraleD", libelle: "Vertébrale droite", type: "choix", options: ["flux antégrade", "flux inversé", "non vue", "occluse"] },
        { cle: "vertebraleG", libelle: "Vertébrale gauche", type: "choix", options: ["flux antégrade", "flux inversé", "non vue", "occluse"] },
        { cle: "sousClaviere", libelle: "Sous-clavières", type: "texte", exemple: "sans sténose" },
      ],
    },
  ],
  calculs() {
    return [];
  },
  propositions(v) {
    const p: Proposition[] = [];
    for (const [cote, nom] of [["D", "droite"], ["G", "gauche"]] as const) {
      const psv = nombre(v, `psv${cote}`);
      if (psv !== null) {
        p.push({
          texte: `ACI ${nom} : vitesse systolique ${fr(psv)} cm/s, ${stenose(psv)}${psv >= 125 ? " : à discuter, confirmation et prise en charge selon les symptômes" : ""}.`,
          source: "Consensus SRU 2003 ; ESC 2024 maladies artérielles",
        });
      }
      if (texte(v, `vertebrale${cote}`) === "flux inversé") {
        p.push({
          texte: `Flux vertébral ${nom} inversé : rechercher une sténose ou une occlusion de la sous-clavière homolatérale (vol sous-clavier).`,
          source: "Critère usuel",
        });
      }
    }
    const epaisseur = nombre(v, "epaisseur");
    if (epaisseur !== null && epaisseur >= 1) {
      p.push({ texte: `Épaisseur intima-média augmentée (${fr(epaisseur, 1)} mm).`, source: "ESH/ESC 2018 (seuil 0,9 à 1 mm)" });
    }
    return p;
  },
  verification:
    "Sténose de l'ACI d'après la vitesse systolique : < 125 cm/s (< 50 %), 125 à 230 (50 à 69 %), > 230 (≥ 70 %), consensus SRU ; sténoses à confirmer par la méthode NASCET ou l'angioscanner. À relire contre les recommandations avant usage clinique.",
};

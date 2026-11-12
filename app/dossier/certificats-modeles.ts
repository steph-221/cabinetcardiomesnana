// Modèles de certificats médicaux : champs à remplir et texte généré. Module sans accès base (utilisé aussi dans
// le navigateur pour l'aperçu en direct). Le texte généré reste modifiable par le médecin avant l'enregistrement.

export type ChampCertificat = {
  cle: string;
  libelle: string;
  type: "texte" | "long" | "date" | "nombre" | "choix";
  options?: string[];
  defaut?: string;
  placeholder?: string;
};

export type Valeurs = Record<string, string>;

export type PatientCertificat = { nom: string; prenom: string; sexe: "" | "F" | "M"; naissance: string | null };

export type ContexteCertificat = {
  patient: PatientCertificat;
  date: string; // jour de rédaction, "AAAA-MM-JJ"
  medecin: string;
  ville: string;
};

export type ModeleCertificat = {
  cle: string;
  libelle: string;
  groupe: string;
  champs: ChampCertificat[];
  // Texte propre au modèle ; `v` rend la valeur saisie ou des points de suspension
  corps: (v: (cle: string) => string, c: Accords, valeurs: Valeurs) => string;
};

// Accords selon le sexe du patient
export type Accords = { il: string; e: string; lui: string };

const POINTS = "……";

// --- Dates ---

const jourVersDate = (j: string) => new Date(`${j}T12:00:00Z`);
const dateVersJour = (d: Date) => d.toISOString().slice(0, 10);
const jourValide = (j: string) => /^\d{4}-\d{2}-\d{2}$/.test(j) && !Number.isNaN(jourVersDate(j).getTime());

export const dateFr = (j: string) => (jourValide(j) ? j.split("-").reverse().join("/") : POINTS);

export function ajouterJours(jour: string, n: number) {
  const d = jourVersDate(jour);
  d.setUTCDate(d.getUTCDate() + n);
  return dateVersJour(d);
}

function ajouterMois(jour: string, n: number) {
  const d = jourVersDate(jour);
  const jourDuMois = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  // 31 janvier + 1 mois = fin février
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jourDuMois, dernier));
  return dateVersJour(d);
}

// Dernier jour inclus d'une période commençant à `debut` : « 3 jours à compter du 01/11 » finit le 03/11
export function finDePeriode(debut: string, nombre: number, unite: "jours" | "mois" = "jours") {
  if (!jourValide(debut) || !Number.isFinite(nombre) || nombre < 1) return "";
  return unite === "mois" ? ajouterJours(ajouterMois(debut, nombre), -1) : ajouterJours(debut, nombre - 1);
}

const dateLongue = (j: string) =>
  jourValide(j)
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
        jourVersDate(j),
      )
    : POINTS;

// --- Nombres en lettres (durées d'ITT : 0 à 99) ---

const unites = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const dizaines = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

export function enLettres(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n <= 16) return unites[n];
  if (n < 20) return `dix-${unites[n - 10]}`;
  if (n < 70) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? dizaines[d] : u === 1 ? `${dizaines[d]} et un` : `${dizaines[d]}-${unites[u]}`;
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${enLettres(n - 60)}`;
  if (n === 80) return "quatre-vingts";
  return `quatre-vingt-${enLettres(n - 80)}`;
}

// --- Patient ---

export function ageAu(naissance: string | null, jour: string) {
  if (!naissance || !jourValide(naissance) || !jourValide(jour)) return null;
  const [an, mois, j] = naissance.split("-").map(Number);
  const [a2, m2, j2] = jour.split("-").map(Number);
  return a2 - an - (m2 < mois || (m2 === mois && j2 < j) ? 1 : 0);
}

export function civilite(p: PatientCertificat, jour: string) {
  const a = ageAu(p.naissance, jour);
  if (a !== null && a < 15) return "Enfant";
  return p.sexe === "F" ? "Mme" : p.sexe === "M" ? "M." : "M./Mme";
}

export function accords(p: PatientCertificat): Accords {
  return p.sexe === "F"
    ? { il: "Elle", e: "e", lui: "elle" }
    : p.sexe === "M"
      ? { il: "Il", e: "", lui: "lui" }
      : { il: "Il/Elle", e: "(e)", lui: "lui/elle" };
}

const OUI_NON = ["Oui", "Non"];
const dateDebut = (libelle = "Date de début"): ChampCertificat => ({ cle: "debut", libelle, type: "date", defaut: "aujourdhui" });

// --- Modèles ---

export const modeles: ModeleCertificat[] = [
  // Modèles de base
  {
    cle: "arret-travail",
    libelle: "Arrêt de travail",
    groupe: "Base",
    champs: [
      { cle: "jours", libelle: "Nombre de jours", type: "nombre", placeholder: "3" },
      dateDebut(),
      { cle: "sorties", libelle: "Sorties autorisées", type: "choix", options: OUI_NON, defaut: "Oui" },
    ],
    corps: (v, _a, val) => {
      const fin = finDePeriode(val.debut ?? "", Number(val.jours));
      return `Son état de santé nécessite un arrêt de travail d'une durée de ${v("jours")} jours, à compter de ce jour, du ${dateFr(val.debut ?? "")} au ${fin ? dateFr(fin) : POINTS} inclus. Sorties autorisées : ${v("sorties")}.`;
    },
  },
  {
    cle: "reprise-travail",
    libelle: "Reprise de travail",
    groupe: "Base",
    champs: [{ cle: "reprise", libelle: "Date de reprise", type: "date", defaut: "aujourdhui" }],
    corps: (_v, _a, val) =>
      `Son état de santé clinique à ce jour permet la reprise de son activité professionnelle à compter du ${dateFr(val.reprise ?? "")}.`,
  },
  {
    cle: "bonne-sante",
    libelle: "Bonne santé",
    groupe: "Base",
    champs: [],
    corps: (_v, a) =>
      `${a.il} ne présente, à l'examen clinique de ce jour, aucun signe apparent d'affection évolutive ou contagieuse.`,
  },
  {
    cle: "aptitude-travail",
    libelle: "Aptitude au travail",
    groupe: "Base",
    champs: [{ cle: "profession", libelle: "Profession ou poste", type: "texte", placeholder: "enseignant" }],
    corps: (v, a) =>
      `À l'examen clinique de ce jour, ${a.il.toLowerCase()} ne présente aucune contre-indication apparente à l'exercice de la profession de ${v("profession")}.`,
  },
  {
    cle: "ald",
    libelle: "Affection de longue durée (ALD)",
    groupe: "Base",
    champs: [],
    corps: () =>
      "Son état de santé nécessite des soins prolongés justifiant une prise en charge au titre des Affections de Longue Durée (ALD). Ce certificat est rédigé pour appuyer sa demande auprès de sa caisse d'assurance maladie.",
  },
  {
    cle: "concours",
    libelle: "Concours",
    groupe: "Base",
    champs: [{ cle: "concours", libelle: "Nom du concours", type: "texte" }],
    corps: (v, a) =>
      `${a.il} ne présente, à l'examen clinique de ce jour, aucune contre-indication médicale apparente à la présentation des épreuves physiques et intellectuelles du concours de ${v("concours")}.`,
  },
  {
    cle: "presence",
    libelle: "Présence à la consultation",
    groupe: "Base",
    champs: [],
    corps: (_v, a) => `${a.il} s'est présenté${a.e} ce jour à ma consultation de cardiologie.`,
  },
  // Sport et scolarité
  {
    cle: "sport",
    libelle: "Absence de contre-indication au sport",
    groupe: "Sport et scolarité",
    champs: [
      { cle: "sport", libelle: "Sport", type: "texte", placeholder: "football" },
      { cle: "ecg", libelle: "Au vu d'un ECG de repos", type: "choix", options: OUI_NON, defaut: "Oui" },
    ],
    corps: (v, a, val) =>
      `${a.il} ne présente, à l'examen clinique de ce jour${val.ecg === "Oui" ? " et au vu de l'électrocardiogramme de repos" : ""}, aucune contre-indication apparente à la pratique de ${v("sport")} en compétition.`,
  },
  {
    cle: "eps",
    libelle: "Dispense d'éducation physique (EPS)",
    groupe: "Sport et scolarité",
    champs: [
      { cle: "type", libelle: "Dispense", type: "choix", options: ["totale", "partielle"], defaut: "totale" },
      { cle: "nombre", libelle: "Durée", type: "nombre", placeholder: "15" },
      { cle: "unite", libelle: "Unité", type: "choix", options: ["jours", "mois"], defaut: "jours" },
      dateDebut(),
    ],
    corps: (v, _a, val) => {
      const fin = finDePeriode(val.debut ?? "", Number(val.nombre), val.unite === "mois" ? "mois" : "jours");
      return `Son état de santé nécessite une dispense ${v("type")} d'Éducation Physique et Sportive (EPS) pour une durée de ${v("nombre")} ${val.unite || "jours"}, du ${dateFr(val.debut ?? "")} au ${fin ? dateFr(fin) : POINTS} inclus.`;
    },
  },
  {
    cle: "enfant-malade",
    libelle: "Enfant malade (présence parentale)",
    groupe: "Sport et scolarité",
    champs: [
      { cle: "enfant", libelle: "Prénom et nom de l'enfant", type: "texte" },
      { cle: "parent", libelle: "Parent", type: "choix", options: ["père", "mère"], defaut: "mère" },
      { cle: "jours", libelle: "Nombre de jours", type: "nombre", placeholder: "3" },
      dateDebut(),
    ],
    corps: (v, _a, val) => {
      const fin = finDePeriode(val.debut ?? "", Number(val.jours));
      return `L'état de santé de l'enfant ${v("enfant")} nécessite la présence constante de ${val.parent === "père" ? "son père" : "sa mère"} à son chevet pendant ${v("jours")} jours, du ${dateFr(val.debut ?? "")} au ${fin ? dateFr(fin) : POINTS} inclus.`;
    },
  },
  {
    cle: "non-contagion",
    libelle: "Non-contagion (retour en collectivité)",
    groupe: "Sport et scolarité",
    champs: [{ cle: "retour", libelle: "Retour à compter du", type: "date", defaut: "aujourdhui" }],
    corps: (_v, a, val) =>
      `${a.il} est à ce jour guéri${a.e} et indemne de toute affection cliniquement contagieuse. Son état de santé autorise le retour en collectivité à compter du ${dateFr(val.retour ?? "")}.`,
  },
  // Administratif et voyages
  {
    cle: "voyage",
    libelle: "Aptitude au voyage (avion)",
    groupe: "Administratif et voyage",
    champs: [{ cle: "cardio", libelle: "Préciser « et cardiovasculaire »", type: "choix", options: OUI_NON, defaut: "Oui" }],
    corps: (_v, a, val) =>
      `${a.il} ne présente ce jour, sur le plan clinique${val.cardio === "Oui" ? " et cardiovasculaire" : ""}, aucune contre-indication médicale apparente pour entreprendre un voyage aérien long-courrier.`,
  },
  {
    cle: "grossesse",
    libelle: "Grossesse",
    groupe: "Administratif et voyage",
    champs: [
      { cle: "semaines", libelle: "Semaines d'aménorrhée", type: "nombre", placeholder: "12" },
      { cle: "debutGrossesse", libelle: "Date présumée du début de grossesse", type: "date" },
    ],
    corps: (v, _a, val) =>
      `L'examen clinique de ce jour confirme un état de grossesse évolutive, estimée à ${v("semaines")} semaines d'aménorrhée. La date présumée du début de grossesse est fixée au ${dateFr(val.debutGrossesse ?? "")}.`,
  },
  {
    cle: "tap",
    libelle: "Transport assis professionnalisé (TAP)",
    groupe: "Administratif et voyage",
    champs: [
      { cle: "transport", libelle: "Transport", type: "choix", options: ["VSL", "Taxi conventionné", "Ambulance"], defaut: "VSL" },
      { cle: "depart", libelle: "Lieu de départ", type: "texte" },
      { cle: "arrivee", libelle: "Lieu de consultation ou de soins", type: "texte" },
      { cle: "raison", libelle: "Incapacité", type: "texte", placeholder: "déficit moteur, traitement invalidant" },
    ],
    corps: (v) =>
      `Son état de santé justifie un transport par ${v("transport")} pour se rendre de ${v("depart")} à ${v("arrivee")}, en raison de ${v("raison")}.`,
  },
  // Cardiologie et médico-légal
  {
    cle: "preoperatoire",
    libelle: "Bilan cardiovasculaire pré-opératoire",
    groupe: "Cardiologie et médico-légal",
    champs: [
      { cle: "intervention", libelle: "Type d'intervention", type: "texte" },
      { cle: "anesthesie", libelle: "Anesthésie", type: "choix", options: ["générale", "locale", "locorégionale"], defaut: "générale" },
    ],
    corps: (v) =>
      `L'évaluation cardiovasculaire réalisée ce jour, comprenant un examen clinique et un électrocardiogramme, ne met pas en évidence de sur-risque cardiaque apparent contre-indiquant l'intervention chirurgicale de ${v("intervention")} prévue sous anesthésie ${v("anesthesie")}.`,
  },
  {
    cle: "coups-blessures",
    libelle: "Constat de coups et blessures (ITT)",
    groupe: "Cardiologie et médico-légal",
    champs: [
      { cle: "nature", libelle: "Faits", type: "choix", options: ["agression", "accident"], defaut: "agression" },
      { cle: "dateFaits", libelle: "Date des faits", type: "date" },
      { cle: "heure", libelle: "Heure", type: "texte", placeholder: "21 h 30" },
      { cle: "lesions", libelle: "Lésions (une par ligne : type, taille en cm, forme, couleur, localisation)", type: "long" },
      { cle: "itt", libelle: "ITT (jours)", type: "nombre", placeholder: "5" },
    ],
    corps: (v, _a, val) => {
      const n = Number(val.itt);
      const itt = Number.isInteger(n) && n >= 0 ? `${enLettres(n)} (${n})` : `${POINTS} (${POINTS})`;
      const lesions = (val.lesions ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      return [
        `Le patient déclare avoir été victime d'${val.nature === "accident" ? "un accident" : "une agression"} le ${dateFr(val.dateFaits ?? "")} à ${v("heure")}.`,
        "À l'examen clinique de ce jour, je constate les lésions suivantes :",
        ...(lesions.length ? lesions.map((l) => `- ${l}`) : ["- " + POINTS]),
        `L'ensemble de ces lésions, compatibles avec les faits allégués, justifie une Incapacité Totale de Travail (ITT) au sens pénal de ${itt} jours, sous réserve de complications ultérieures.`,
      ].join("\n");
    },
  },
  {
    cle: "libre",
    libelle: "Certificat libre",
    groupe: "Autre",
    champs: [{ cle: "texte", libelle: "Texte du certificat", type: "long" }],
    corps: (v) => v("texte"),
  },
];

export const groupesModeles = [...new Set(modeles.map((m) => m.groupe))];
export const trouverModeleCertificat = (cle: string) => modeles.find((m) => m.cle === cle);

// Valeurs initiales du formulaire : « aujourdhui » devient la date du jour
export function valeursInitiales(m: ModeleCertificat, aujourdhui: string): Valeurs {
  return Object.fromEntries(m.champs.map((c) => [c.cle, c.defaut === "aujourdhui" ? aujourdhui : (c.defaut ?? "")]));
}

// --- Texte complet ---

export function enTete(c: ContexteCertificat) {
  const a = accords(c.patient);
  const nom = [c.patient.nom.toUpperCase(), c.patient.prenom].filter(Boolean).join(" ");
  const naissance = c.patient.naissance ? `, né${a.e} le ${dateFr(c.patient.naissance)}` : "";
  const civ = civilite(c.patient, c.date);
  return `Je soussigné, ${c.medecin}, certifie avoir examiné ce jour, le ${dateLongue(c.date)}, ${civ} ${nom}${naissance}.`;
}

export function piedDePage(c: ContexteCertificat) {
  const a = accords(c.patient);
  return `Fait à ${c.ville}, le ${dateFr(c.date)}.\nCertificat rédigé à la demande de l'intéressé${a.e} et remis en mains propres pour valoir et servir ce que de droit.`;
}

// Texte complet proposé au médecin : en-tête légal, corps du modèle, pied de page
export function composerCertificat(m: ModeleCertificat, valeurs: Valeurs, c: ContexteCertificat) {
  const v = (cle: string) => (valeurs[cle] ?? "").trim() || POINTS;
  const corps = m.corps(v, accords(c.patient), valeurs);
  return [enTete(c), corps, piedDePage(c)].join("\n\n");
}

// --- Modèles personnels du médecin (enregistrés en base, voir modeles-certificats-perso.ts) ---

export type ModelePerso = { id: number; libelle: string; texte: string };

export const PREFIXE_PERSO = "perso:";
export const GROUPE_PERSO = "Mes modèles";
// Nom du modèle personnel conservé avec le certificat : l'historique garde son titre même si le modèle est supprimé
export const CHAMP_LIBELLE_PERSO = "_libelle";

// Un modèle personnel est un texte à compléter, comme le certificat « libre » : l'en-tête légal et la formule finale
// restent ajoutés automatiquement
export function modeleDepuisPerso(m: ModelePerso): ModeleCertificat {
  return {
    cle: `${PREFIXE_PERSO}${m.id}`,
    libelle: m.libelle,
    groupe: GROUPE_PERSO,
    champs: [{ cle: "texte", libelle: "Texte du modèle", type: "long", defaut: m.texte }],
    corps: (v) => v("texte"),
  };
}

export const idModelePerso = (cle: string) => (cle.startsWith(PREFIXE_PERSO) ? Number(cle.slice(PREFIXE_PERSO.length)) || null : null);

export const titreCertificat = (cle: string, champs?: Record<string, string>) =>
  cle.startsWith(PREFIXE_PERSO)
    ? (champs?.[CHAMP_LIBELLE_PERSO] || "Certificat personnalisé")
    : (trouverModeleCertificat(cle)?.libelle ?? "Certificat");

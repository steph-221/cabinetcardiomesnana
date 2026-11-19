// Thèmes cliniques de la bibliothèque : une recommandation, un article ou un médicament est rangé d'après les mots de
// son titre (français et anglais). Classement automatique et gratuit ; une source peut relever de plusieurs thèmes.
// Aucun accès à la base ici : module testable seul.

export const themes = [
  { cle: "fa", libelle: "Fibrillation atriale et rythme", mots: ["fibrillation", "atrial", "arrhythm", "arythm", "tachycardi", "syncope", "pacing", "stimulation", "defibrillat", "resynchronization", "resynchronisation", "ablation", "sudden cardiac", "mort subite", "ventricular"] },
  { cle: "ic", libelle: "Insuffisance cardiaque", mots: ["heart failure", "insuffisance cardiaque", "cardiac failure", "lvad", "transplant"] },
  { cle: "coronaires", libelle: "Coronaires et infarctus", mots: ["coronary", "coronaire", "myocardial infarction", "infarctus", "angina", "angor", "acute coronary", "revascular", "stent", "angioplast", "chronic coronary"] },
  { cle: "hta", libelle: "Hypertension artérielle", mots: ["hypertension", "blood pressure", "pression arterielle", "antihypertens"] },
  { cle: "valves", libelle: "Valvulopathies", mots: ["valv", "aortic stenosis", "mitral", "tavi", "tavr", "endocarditis", "endocardite", "rheumatic", "rhumatism"] },
  { cle: "lipides", libelle: "Lipides et prévention", mots: ["lipid", "dyslipid", "cholesterol", "statin", "prevention", "prévention", "risk score", "heartscore", "lifestyle"] },
  { cle: "thrombose", libelle: "Thrombose et anticoagulants", mots: ["pulmonary embol", "embolie pulmonaire", "venous thrombo", "thrombose", "anticoag", "antithromb", "antiplatelet", "warfarin", "avk", "doac", "noac"] },
  { cle: "cardiomyopathies", libelle: "Cardiomyopathies, myocardites, péricarde", mots: ["cardiomyopath", "myocardit", "pericard", "amyloid", "amylose", "hypertrophic", "dilated"] },
  { cle: "onco-grossesse", libelle: "Cardio-oncologie, grossesse, congénital", mots: ["cardio-oncology", "oncolog", "cancer", "chemotherap", "pregnan", "grossesse", "congenital", "congénital", "adult congenital"] },
  { cle: "metabolisme", libelle: "Diabète, rein, obésité", mots: ["diabet", "kidney", "renal", "rénal", "obesity", "obésité", "metabolic"] },
  { cle: "aorte", libelle: "Aorte, artères et veines", mots: ["aort", "peripheral arter", "artériopathie", "arteriopath", "carotid", "carotide", "vascular", "pulmonary hypertension", "hypertension pulmonaire", "varic"] },
  { cle: "imagerie", libelle: "Imagerie et examens", mots: ["echocardiograph", "échocardiograph", "imaging", "imagerie", "ecg", "electrocardiogra", "holter", "mapa", "stress test", "épreuve d'effort", "scanner", "ct angiography", "cardiac mri", "irm", "doppler"] },
] as const;

export type CleTheme = (typeof themes)[number]["cle"];
export const estTheme = (c: string): c is CleTheme => themes.some((t) => t.cle === c);

const normaliser = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Sigles courts : comptés seulement comme mots entiers, pour ne pas se trouver à l'intérieur d'un autre mot
const ENTIERS = new Set(["avk", "irm", "ecg", "tavi", "tavr", "mapa", "doac", "noac", "lvad", "ct"]);

// Les mots-clés de chaque thème, sans accents, pour la comparaison
const mots = themes.map((t) => ({ cle: t.cle, mots: t.mots.map(normaliser) }));

// Thèmes d'un texte (titre, résumé), du plus au moins probable ; aucun si rien ne correspond.
export function themesDe(texte: string): CleTheme[] {
  const t = normaliser(texte);
  const trouves = mots
    .map(({ cle, mots }) => ({
      cle,
      n: mots.filter((m) => (ENTIERS.has(m) ? new RegExp(`(?<![a-z])${m}(?![a-z])`).test(t) : t.includes(m))).length,
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  return trouves.map((x) => x.cle);
}

export const libelleTheme = (cle: string) => themes.find((t) => t.cle === cle)?.libelle ?? cle;

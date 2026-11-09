// Repères de cardiologie pour trier les médicaments de medicament.ma : familles (par substance active),
// situations cliniques (symptômes, pathologies) et posologies usuelles de l'adulte.
// Tout ceci est une AIDE d'information : le médecin décide. Les posologies sont des repères courants à vérifier
// dans les recommandations de la bibliothèque et selon le patient (âge, poids, fonction rénale, interactions).
// Sans accès à la base : sert aussi dans le navigateur.

export type Famille = { cle: string; libelle: string; dci: string[] };

// Une famille = des substances actives (noms français, sans accents ni casse)
export const familles: Famille[] = [
  { cle: "iec", libelle: "IEC", dci: ["ramipril", "perindopril", "enalapril", "lisinopril", "captopril", "quinapril", "trandolapril", "benazepril", "fosinopril", "zofenopril"] },
  { cle: "ara2", libelle: "ARA II (sartans)", dci: ["losartan", "valsartan", "irbesartan", "candesartan", "telmisartan", "olmesartan", "azilsartan", "eprosartan"] },
  { cle: "arni", libelle: "ARNI (sacubitril/valsartan)", dci: ["sacubitril"] },
  { cle: "bb", libelle: "Bêtabloquants", dci: ["bisoprolol", "metoprolol", "nebivolol", "carvedilol", "atenolol", "propranolol", "acebutolol", "labetalol", "betaxolol", "celiprolol", "nadolol"] },
  { cle: "ica-dhp", libelle: "Inhibiteurs calciques (dihydropyridines)", dci: ["amlodipine", "nifedipine", "lercanidipine", "felodipine", "nicardipine", "lacidipine", "isradipine", "nitrendipine", "manidipine"] },
  { cle: "ica-ndhp", libelle: "Inhibiteurs calciques (diltiazem, vérapamil)", dci: ["diltiazem", "verapamil"] },
  { cle: "thiazidique", libelle: "Diurétiques thiazidiques et apparentés", dci: ["hydrochlorothiazide", "indapamide", "chlortalidone", "chlorthalidone", "bendroflumethiazide"] },
  { cle: "anse", libelle: "Diurétiques de l'anse", dci: ["furosemide", "bumetanide", "torasemide"] },
  { cle: "arm", libelle: "Antagonistes de l'aldostérone et épargneurs de potassium", dci: ["spironolactone", "eplerenone", "amiloride", "finerenone"] },
  { cle: "sglt2", libelle: "Inhibiteurs SGLT2", dci: ["dapagliflozine", "empagliflozine", "canagliflozine"] },
  { cle: "centraux", libelle: "Antihypertenseurs centraux et alphabloquants", dci: ["methyldopa", "clonidine", "moxonidine", "rilmenidine", "urapidil", "doxazosine", "prazosine"] },
  { cle: "antiagregant", libelle: "Antiagrégants plaquettaires", dci: ["acide acetylsalicylique", "aspirine", "clopidogrel", "ticagrelor", "prasugrel", "ticlopidine", "dipyridamole"] },
  { cle: "aod", libelle: "Anticoagulants oraux directs", dci: ["rivaroxaban", "apixaban", "dabigatran", "edoxaban"] },
  { cle: "avk", libelle: "Antivitamines K", dci: ["warfarine", "acenocoumarol", "fluindione", "phenprocoumone"] },
  { cle: "hbpm", libelle: "Héparines (injectables)", dci: ["enoxaparine", "nadroparine", "tinzaparine", "daltéparine", "dalteparine", "heparine", "fondaparinux"] },
  { cle: "statine", libelle: "Statines", dci: ["atorvastatine", "rosuvastatine", "simvastatine", "pravastatine", "fluvastatine", "pitavastatine"] },
  { cle: "hypolipemiant-autre", libelle: "Autres hypolipémiants (ézétimibe, fibrates, anti-PCSK9)", dci: ["ezetimibe", "fenofibrate", "gemfibrozil", "ciprofibrate", "evolocumab", "alirocumab", "acide bempedoique"] },
  { cle: "antiarythmique", libelle: "Antiarythmiques", dci: ["amiodarone", "flecainide", "propafenone", "sotalol", "dronedarone", "disopyramide", "quinidine"] },
  { cle: "digitalique", libelle: "Digitaliques", dci: ["digoxine", "digitoxine"] },
  { cle: "ivabradine", libelle: "Ivabradine (inhibiteur If)", dci: ["ivabradine"] },
  { cle: "antiangineux", libelle: "Antiangineux (nitrés, nicorandil, ranolazine, trimétazidine)", dci: ["trimetazidine", "nicorandil", "ranolazine", "isosorbide", "trinitrine", "nitroglycerine", "molsidomine"] },
  { cle: "htap", libelle: "Hypertension pulmonaire", dci: ["sildenafil", "tadalafil", "bosentan", "ambrisentan", "macitentan", "selexipag", "riociguat", "treprostinil"] },
  { cle: "veino", libelle: "Veinotoniques et vasculoprotecteurs", dci: ["diosmine", "hesperidine", "troxerutine", "naftidrofuryl", "pentoxifylline", "cilostazol"] },
];

export const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const jetons = (s: string) => normaliser(s);

// Familles d'un médicament, d'après sa composition (une association en a plusieurs)
export function famillesDe(dci: string): string[] {
  const texte = jetons(dci);
  return familles.filter((f) => f.dci.some((d) => texte.includes(normaliser(d)))).map((f) => f.cle);
}

export const libelleFamille = (cle: string) => familles.find((f) => f.cle === cle)?.libelle ?? cle;

// Situations cliniques : ce que le cardiologue cherche (symptôme, pathologie, objectif), et les familles en rapport
export type Situation = { cle: string; libelle: string; indice: string; familles: string[] };

export const situations: Situation[] = [
  { cle: "hta", libelle: "Hypertension artérielle", indice: "TA élevée, HTA", familles: ["iec", "ara2", "ica-dhp", "thiazidique", "bb", "arm", "centraux"] },
  { cle: "ic-reduite", libelle: "Insuffisance cardiaque à FEVG réduite", indice: "dyspnée, œdèmes, FEVG ≤ 40 %", familles: ["iec", "ara2", "arni", "bb", "arm", "sglt2", "anse", "ivabradine", "digitalique"] },
  { cle: "congestion", libelle: "Congestion, œdèmes des membres inférieurs", indice: "œdèmes, prise de poids, orthopnée", familles: ["anse", "thiazidique", "arm"] },
  { cle: "angor", libelle: "Angor, douleur thoracique d'effort", indice: "douleur thoracique, angor, ischémie", familles: ["bb", "ica-dhp", "ica-ndhp", "antiangineux", "ivabradine"] },
  { cle: "post-sca", libelle: "Après infarctus, syndrome coronarien ou stent", indice: "IDM, SCA, angioplastie, stent", familles: ["antiagregant", "bb", "iec", "ara2", "statine", "arm"] },
  { cle: "fa-anticoag", libelle: "Fibrillation atriale : anticoagulation", indice: "FA, ACFA, flutter", familles: ["aod", "avk"] },
  { cle: "fa-frequence", libelle: "Fibrillation atriale : contrôle de la fréquence", indice: "FA rapide, tachycardie, palpitations", familles: ["bb", "ica-ndhp", "digitalique"] },
  { cle: "rythme", libelle: "Maintien du rythme sinusal, troubles du rythme", indice: "palpitations, extrasystoles, TV", familles: ["antiarythmique", "bb"] },
  { cle: "dyslipidemie", libelle: "Dyslipidémie, prévention cardiovasculaire", indice: "LDL élevé, hypercholestérolémie", familles: ["statine", "hypolipemiant-autre"] },
  { cle: "thrombose-veineuse", libelle: "Thrombose veineuse, embolie pulmonaire", indice: "TVP, EP, phlébite", familles: ["aod", "hbpm", "avk"] },
  { cle: "prevention-arterielle", libelle: "Prévention thrombotique artérielle (AOMI, AVC, coronaire)", indice: "AOMI, AIT, athérome", familles: ["antiagregant", "statine"] },
  { cle: "htap", libelle: "Hypertension pulmonaire", indice: "HTAP, dyspnée d'effort", familles: ["htap"] },
  { cle: "veineux", libelle: "Insuffisance veineuse, jambes lourdes, claudication", indice: "jambes lourdes, claudication", familles: ["veino"] },
];

export const libelleSituation = (cle: string) => situations.find((s) => s.cle === cle)?.libelle ?? cle;

// Posologie usuelle de l'adulte, par substance (repère d'information, à adapter). Clé = début du nom de la substance.
export type Repere = { dci: string; posologie: string; attention: string };

export const reperes: Repere[] = [
  { dci: "ramipril", posologie: "2,5 mg le matin, à augmenter par paliers jusqu'à 5–10 mg/j", attention: "Créatinine et kaliémie à 1–2 semaines ; grossesse ; angio-œdème" },
  { dci: "perindopril", posologie: "5 mg le matin, puis 10 mg/j", attention: "Créatinine et kaliémie ; grossesse ; angio-œdème" },
  { dci: "enalapril", posologie: "5 à 20 mg/j en 1 à 2 prises", attention: "Créatinine et kaliémie ; grossesse" },
  { dci: "lisinopril", posologie: "5 à 20 mg/j en 1 prise", attention: "Créatinine et kaliémie ; grossesse" },
  { dci: "losartan", posologie: "50 mg/j (jusqu'à 100 mg/j)", attention: "Créatinine et kaliémie ; grossesse" },
  { dci: "valsartan", posologie: "80 à 160 mg/j (IC : 40 mg x2, à titrer jusqu'à 160 mg x2)", attention: "Créatinine et kaliémie ; grossesse" },
  { dci: "irbesartan", posologie: "150 mg/j, puis 300 mg/j", attention: "Créatinine et kaliémie ; grossesse" },
  { dci: "candesartan", posologie: "8 mg/j, puis 16–32 mg/j", attention: "Créatinine et kaliémie ; grossesse" },
  { dci: "telmisartan", posologie: "40 à 80 mg/j", attention: "Créatinine et kaliémie ; grossesse" },
  { dci: "sacubitril", posologie: "24/26 mg x2/j, à doubler toutes les 2–4 semaines jusqu'à 97/103 mg x2/j", attention: "Ne pas associer à un IEC (36 h d'intervalle) ; angio-œdème ; hypotension" },
  { dci: "bisoprolol", posologie: "1,25 mg/j en IC (titration lente jusqu'à 10 mg/j) ; 5–10 mg/j en HTA ou angor", attention: "Bradycardie, BAV, asthme sévère ; ne pas arrêter brutalement" },
  { dci: "nebivolol", posologie: "5 mg/j (1,25 mg/j puis titration en IC)", attention: "Bradycardie, BAV, asthme sévère" },
  { dci: "metoprolol", posologie: "50 à 200 mg/j (forme LP en 1 prise)", attention: "Bradycardie, BAV, asthme sévère" },
  { dci: "carvedilol", posologie: "3,125 mg x2/j, à doubler toutes les 2 semaines jusqu'à 25 mg x2/j", attention: "Bradycardie, BAV, hypotension ; à prendre au cours d'un repas" },
  { dci: "atenolol", posologie: "50 à 100 mg/j", attention: "Adapter si insuffisance rénale ; bradycardie, BAV" },
  { dci: "amlodipine", posologie: "5 mg/j, puis 10 mg/j", attention: "Œdèmes des chevilles ; évite la forme associée si bradycardie sans lien" },
  { dci: "lercanidipine", posologie: "10 mg/j, jusqu'à 20 mg/j", attention: "Œdèmes ; interactions (inhibiteurs du CYP3A4)" },
  { dci: "nifedipine", posologie: "30 à 60 mg/j (forme LP)", attention: "Œdèmes, céphalées ; pas de forme à libération immédiate" },
  { dci: "diltiazem", posologie: "120 à 360 mg/j (forme LP)", attention: "Bradycardie, BAV, FEVG altérée : contre-indiqué ; interactions" },
  { dci: "verapamil", posologie: "120 à 360 mg/j en 2–3 prises (ou forme LP)", attention: "Bradycardie, BAV, FEVG altérée : contre-indiqué ; ne pas associer à un bêtabloquant sans avis" },
  { dci: "indapamide", posologie: "1,5 mg LP (ou 2,5 mg) le matin", attention: "Natrémie, kaliémie, uricémie" },
  { dci: "hydrochlorothiazide", posologie: "12,5 à 25 mg le matin", attention: "Natrémie, kaliémie, glycémie, uricémie" },
  { dci: "furosemide", posologie: "20 à 80 mg/j selon la congestion (à ajuster au poids sec)", attention: "Kaliémie, créatinine, déshydratation ; ototoxicité à fortes doses" },
  { dci: "torasemide", posologie: "5 à 20 mg/j", attention: "Kaliémie, créatinine" },
  { dci: "spironolactone", posologie: "25 mg/j (12,5 à 50 mg/j en IC)", attention: "Hyperkaliémie, créatinine ; gynécomastie" },
  { dci: "eplerenone", posologie: "25 mg/j puis 50 mg/j", attention: "Hyperkaliémie ; inhibiteurs puissants du CYP3A4 contre-indiqués" },
  { dci: "dapagliflozine", posologie: "10 mg/j", attention: "Mycoses génitales, déshydratation, acidocétose ; fonction rénale" },
  { dci: "empagliflozine", posologie: "10 mg/j", attention: "Mycoses génitales, déshydratation, acidocétose ; fonction rénale" },
  { dci: "ivabradine", posologie: "5 mg x2/j, puis 7,5 mg x2/j selon la fréquence (cible 50–60/min)", attention: "Rythme sinusal uniquement ; bradycardie ; phosphènes" },
  { dci: "acide acetylsalicylique", posologie: "75 à 100 mg/j", attention: "Risque hémorragique ; ulcère ; allergie" },
  { dci: "aspirine", posologie: "75 à 100 mg/j", attention: "Risque hémorragique ; ulcère ; allergie" },
  { dci: "clopidogrel", posologie: "75 mg/j (dose de charge 300–600 mg si SCA)", attention: "Risque hémorragique ; interaction avec certains IPP (oméprazole)" },
  { dci: "ticagrelor", posologie: "90 mg x2/j après la dose de charge (180 mg)", attention: "Risque hémorragique ; dyspnée ; aspirine ≤ 100 mg/j" },
  { dci: "prasugrel", posologie: "10 mg/j après la dose de charge (60 mg)", attention: "Risque hémorragique ; contre-indiqué après AVC/AIT ; âge ≥ 75 ans ou poids < 60 kg : 5 mg" },
  { dci: "rivaroxaban", posologie: "FA : 20 mg/j au cours du repas (15 mg/j si clairance 15–49 mL/min)", attention: "Fonction rénale, poids, interactions, risque hémorragique" },
  { dci: "apixaban", posologie: "FA : 5 mg x2/j (2,5 mg x2/j si 2 critères sur âge ≥ 80 ans, poids ≤ 60 kg, créatinine ≥ 15 mg/L)", attention: "Fonction rénale, interactions, risque hémorragique" },
  { dci: "dabigatran", posologie: "FA : 150 mg x2/j (110 mg x2/j si âge ≥ 80 ans ou risque hémorragique élevé)", attention: "Éliminé par le rein : clairance obligatoire ; dyspepsie" },
  { dci: "edoxaban", posologie: "FA : 60 mg/j (30 mg/j si clairance 15–50 mL/min, poids ≤ 60 kg ou inhibiteurs de la P-gp)", attention: "Fonction rénale, poids, risque hémorragique" },
  { dci: "warfarine", posologie: "Dose adaptée à l'INR cible (le plus souvent 2–3)", attention: "INR régulier, interactions, régime" },
  { dci: "acenocoumarol", posologie: "Dose adaptée à l'INR cible (le plus souvent 2–3), 1 prise le soir", attention: "INR régulier, interactions, régime" },
  { dci: "fluindione", posologie: "Dose adaptée à l'INR cible (le plus souvent 2–3), 1 prise le soir", attention: "INR régulier, interactions, régime" },
  { dci: "enoxaparine", posologie: "Curatif : 1 mg/kg x2/j ou 1,5 mg/kg/j ; préventif : 40 mg/j", attention: "Plaquettes (TIH), clairance de la créatinine" },
  { dci: "atorvastatine", posologie: "10 à 80 mg/j (40–80 mg en prévention secondaire ou risque très élevé)", attention: "Myalgies, transaminases ; interactions (macrolides, azolés)" },
  { dci: "rosuvastatine", posologie: "5 à 20 mg/j (40 mg exceptionnellement)", attention: "Myalgies ; insuffisance rénale sévère ; adaptation chez les patients d'origine asiatique" },
  { dci: "simvastatine", posologie: "20 à 40 mg le soir", attention: "Myalgies ; interactions (amlodipine : max 20 mg, diltiazem, amiodarone)" },
  { dci: "pravastatine", posologie: "20 à 40 mg le soir", attention: "Myalgies" },
  { dci: "ezetimibe", posologie: "10 mg/j, seul ou en association à une statine", attention: "Transaminases en association aux statines" },
  { dci: "fenofibrate", posologie: "145 mg/j (ou 200–267 mg/j selon la forme)", attention: "Fonction rénale ; association aux statines à prudence" },
  { dci: "amiodarone", posologie: "Charge 600–800 mg/j puis entretien 200 mg/j (souvent 5 jours sur 7)", attention: "Thyroïde, poumon, foie, œil, QT ; nombreuses interactions (AVK, digoxine)" },
  { dci: "flecainide", posologie: "50 à 100 mg x2/j", attention: "Cardiopathie structurelle et coronaropathie : contre-indiqué ; QRS" },
  { dci: "propafenone", posologie: "150 mg x3/j (ou 225–300 mg x2/j en LP)", attention: "Cardiopathie structurelle : contre-indiqué ; QRS" },
  { dci: "sotalol", posologie: "80 à 160 mg x2/j", attention: "QT, kaliémie, fonction rénale, bradycardie" },
  { dci: "digoxine", posologie: "0,125 à 0,25 mg/j", attention: "Fonction rénale, kaliémie, digoxinémie ; nombreuses interactions" },
  { dci: "trimetazidine", posologie: "35 mg x2/j (forme LP)", attention: "Parkinson et troubles du mouvement : contre-indiqué ; insuffisance rénale" },
  { dci: "nicorandil", posologie: "10 mg x2/j (jusqu'à 20 mg x2/j)", attention: "Ulcérations ; pas d'association aux inhibiteurs de la PDE5" },
  { dci: "ranolazine", posologie: "375 mg x2/j, puis 500–750 mg x2/j", attention: "QT, interactions (CYP3A4), insuffisance rénale" },
  { dci: "isosorbide", posologie: "Dinitrate ou mononitrate LP : 20 à 60 mg/j en 1–2 prises", attention: "Pas d'association aux inhibiteurs de la PDE5 ; hypotension ; tolérance (fenêtre sans nitrés)" },
  { dci: "diosmine", posologie: "1 000 mg/j en 1–2 prises", attention: "Cures de 2 à 3 mois, sans remplacer la compression" },
];

export const repereDe = (dci: string) => {
  const t = normaliser(dci);
  return reperes.find((r) => t.includes(normaliser(r.dci)));
};

// Une ligne de l'ordonnance qui correspond à une allergie notée dans le dossier ? (comparaison sur le nom et la DCI)
export function allergieConcernee(allergies: string, ...noms: string[]): string | null {
  const mots = normaliser(allergies)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 4);
  const texte = normaliser(noms.join(" "));
  return mots.find((m) => texte.includes(m)) ?? null;
}

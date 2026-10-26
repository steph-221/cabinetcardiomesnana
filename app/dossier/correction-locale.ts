// Correction gratuite de la dictée, faite dans le navigateur, sans service extérieur :
// commandes de mise en forme, lexique du cabinet, sigles et médicaments de cardiologie, valeurs chiffrées,
// rangement par rubrique annoncée. Ce qui est corrigé « au jugé » est signalé pour la relecture.

import { bornes } from "./mesures";
import { medicaments, sigles } from "./vocabulaire";

export const rubriques = ["motif", "examen", "ecg", "autres", "conclusion", "conduite"] as const;
export type Rubrique = (typeof rubriques)[number];

export type Correction = {
  rubriques: Record<Rubrique, string>;
  valeurs: Partial<Record<string, number>>;
  incertains: { entendu: string; propose: string }[];
};

// Limites de mot qui reconnaissent les lettres accentuées (« \b » ne connaît que l'anglais)
const D = String.raw`(?<![\p{L}\d])`;
const F = String.raw`(?![\p{L}\d])`;
const LIGNE = "\u2028"; // retour à la ligne provisoire, protégé du nettoyage des espaces

const sansAccents = (texte: string) => texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Distance d'édition entre deux mots (nombre de lettres à changer, ajouter ou retirer)
function distance(a: string, b: string) {
  const ligne = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonale = ligne[0];
    ligne[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const garde = ligne[j];
      ligne[j] = Math.min(ligne[j] + 1, ligne[j - 1] + 1, diagonale + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonale = garde;
    }
  }
  return ligne[b.length];
}

// 1. Commandes dictées : ponctuation et retours à la ligne
function commandes(texte: string) {
  const r = (motif: string, remplacement: string) => (t: string) =>
    t.replace(new RegExp(String.raw`\s*${D}(?:${motif})${F}\s*`, "giu"), remplacement);
  return [
    r("point à la ligne", `.${LIGNE}`),
    r("à la ligne|nouvelle ligne|retour à la ligne|nouveau paragraphe", LIGNE),
    r("point[- ]virgule", " ; "),
    r("virgule", ", "),
    r("deux[- ]points", " : "),
    r("point final", ". "),
    r("ouvrez la parenthèse", " ("),
    r("fermez la parenthèse", ") "),
    (t: string) => t.replace(new RegExp(String.raw`\s*${D}pour ?cent${F}`, "giu"), " %"),
    // « point » seul, sauf dans « mise au point », « point de vue »…
    (t: string) =>
      t.replace(
        new RegExp(String.raw`(?<!${D}(?:au|du|un|de|le|ce))\s+point${F}(?! de vue| d'impact)\s*`, "giu"),
        ". ",
      ),
  ].reduce((t, etape) => etape(t), texte);
}

// 2. Lexique du cabinet : remplacements appris (sans tenir compte des majuscules), les plus longs d'abord
function lexique(texte: string, entrees: { entendu: string; correct: string }[]) {
  return [...entrees]
    .sort((a, b) => b.entendu.length - a.entendu.length)
    .reduce((t, { entendu, correct }) => t.replace(new RegExp(`${D}${echapper(entendu)}${F}`, "giu"), correct), texte);
}

// 3. Sigles : « f e v g », « f.e.v.g. » ou « fevg » → FEVG ; une suite de lettres épelées peut en contenir
// plusieurs (« e t t f e v g » → ETT FEVG)
function siglesEcrits(texte: string) {
  const parForme = new Map(sigles.map(([s]) => [s.toLowerCase(), s]));
  const longueurs = [...new Set(sigles.map(([s]) => s.length))].sort((a, b) => b - a);
  const decouper = (lettres: string) => {
    const morceaux: string[] = [];
    for (let i = 0; i < lettres.length; ) {
      const n = longueurs.find((l) => parForme.has(lettres.slice(i, i + l).toLowerCase()));
      morceaux.push(n ? parForme.get(lettres.slice(i, i + n).toLowerCase())! : lettres[i]);
      i += n ?? 1;
    }
    return morceaux;
  };
  return texte
    .replace(new RegExp(String.raw`${D}(?:\p{L}[. ]){1,9}\p{L}${F}\.?`, "gu"), (morceau) => {
      const parties = decouper(morceau.replace(/[. ]/g, ""));
      // Rien de reconnu : on laisse les lettres telles quelles
      return parties.some((p) => p.length > 1) ? parties.join(" ") : morceau;
    })
    .replace(new RegExp(String.raw`${D}\p{L}{2,6}${F}`, "gu"), (mot) => parForme.get(mot.toLowerCase()) ?? mot);
}

// 4. Médicaments : orthographe proche ou nom coupé en deux (« sin trom ») → nom exact, signalé pour relecture
const MOTS_COURANTS = new Set(["concert", "cardiaque", "amour", "plaque", "valse", "clopide"]);

function medicamentsEcrits(texte: string, incertains: Correction["incertains"]) {
  const formes = medicaments.filter((m) => !/[ /]/.test(m)).map((nom) => ({ nom, forme: sansAccents(nom) }));
  const proche = (candidat: string) => {
    const c = sansAccents(candidat).replace(/[\s-]/g, "");
    if (c.length < 5 || MOTS_COURANTS.has(c)) return null;
    let meilleur: { nom: string; d: number } | null = null;
    for (const { nom, forme } of formes) {
      if (Math.abs(forme.length - c.length) > 2) continue;
      const d = distance(c, forme);
      if (d <= (forme.length >= 8 ? 2 : 1) && (!meilleur || d < meilleur.d)) meilleur = { nom, d };
    }
    return meilleur?.nom ?? null;
  };

  // Deux mots voisins à recoller d'abord (« sin trom », « bi soprolol »), en examinant chaque paire
  const mots = [...texte.matchAll(new RegExp(String.raw`\p{L}+`, "gu"))];
  let resultat = "";
  let position = 0;
  for (let i = 0; i < mots.length - 1; i++) {
    const [a, b] = [mots[i], mots[i + 1]];
    const separateur = texte.slice(a.index + a[0].length, b.index);
    if (!/^[ -]$/.test(separateur) || a[0].length < 2 || b[0].length < 2) continue;
    const nom = proche(a[0] + b[0]);
    if (!nom || proche(a[0]) || proche(b[0])) continue;
    const morceau = `${a[0]}${separateur}${b[0]}`;
    incertains.push({ entendu: morceau, propose: nom });
    resultat += texte.slice(position, a.index) + nom;
    position = b.index + b[0].length;
    i++;
  }
  resultat += texte.slice(position);

  return resultat.replace(new RegExp(String.raw`${D}\p{L}{5,}${F}`, "gu"), (mot) => {
    const nom = proche(mot);
    if (!nom) return mot;
    // Même mot à l'accent ou à la majuscule près : simple remise en forme, sans signalement
    if (sansAccents(nom) !== sansAccents(mot)) incertains.push({ entendu: mot, propose: nom });
    return nom;
  });
}

// 5. Valeurs chiffrées dictées (décimales avec virgule ou point)
function valeursDictees(texte: string): Correction["valeurs"] {
  const v: Correction["valeurs"] = {};
  const n = (s: string) => Number(s.replace(",", "."));
  const apres = String.raw`\s*(?:à|a|de|est de|:|=)?\s*`;
  const cherche = (cle: string, motif: string) => new RegExp(`${D}(?:${cle})${apres}${motif}`, "iu").exec(texte);

  const ta = cherche("TA|tension(?: artérielle)?|PA", String.raw`(\d{1,3})\s*(?:\/|sur|-|\s)\s*(\d{1,3})${F}`);
  if (ta) {
    const [sys, dia] = [n(ta[1]), n(ta[2])];
    // « 13/8 » se dit en centimètres de mercure : 130/80 mmHg
    [v.taSys, v.taDia] = sys < 30 ? [sys * 10, dia * 10] : [sys, dia];
  }
  const simples: [string, string, string][] = [
    ["fc", "FC|fréquence cardiaque|pouls", String.raw`(\d{2,3})${F}`],
    ["spo2", "SpO2|SpO₂|saturation|sat", String.raw`(\d{2,3})${F}`],
    ["poids", "poids", String.raw`(\d{2,3}(?:[.,]\d)?)${F}`],
    ["inr", "INR", String.raw`(\d(?:[.,]\d{1,2})?)${F}`],
    ["fevg", "FEVG|fraction d'éjection(?: du ventricule gauche)?", String.raw`(\d{2})${F}`],
    ["ldl", "LDL(?:[- ]?c(?:holestérol)?)?", String.raw`(\d(?:[.,]\d{1,2})?)\s*(?:g\/l|grammes?)${F}`],
    ["creatinine", String.raw`créatinin\p{L}*`, String.raw`(\d{1,3}(?:[.,]\d)?)\s*(?:mg\/l|milligrammes?)${F}`],
    ["hba1c", "HbA1c|hémoglobine glyquée", String.raw`(\d{1,2}(?:[.,]\d)?)${F}`],
    ["ntprobnp", "NT[- ]?pro[- ]?BNP", String.raw`(\d{2,6})${F}`],
  ];
  for (const [cle, mots, motif] of simples) {
    const trouve = cherche(mots, motif);
    if (trouve) v[cle] = n(trouve[1]);
  }
  const taille = cherche("taille", String.raw`(1[.,]\d{2}|\d{3})${F}`);
  if (taille) v.taille = /[.,]/.test(taille[1]) ? Math.round(n(taille[1]) * 100) : n(taille[1]);

  // Une valeur invraisemblable est écartée : elle reste dans le texte
  for (const [cle, valeur] of Object.entries(v)) {
    const [min, max] = bornes[cle];
    if (valeur === undefined || valeur < min || valeur > max) delete v[cle];
  }
  return v;
}

// 6. Rubriques. Une annonce « forte » compte partout ; une « faible » seulement en début de phrase ou suivie de « : ».
// Sans aucune annonce, le texte va en conclusion.
const ANNONCES: { rubrique: Rubrique; forte?: string; faible?: string }[] = [
  { rubrique: "motif", forte: "motifs? de (?:la )?consultation|motifs?" },
  { rubrique: "examen", forte: "examen clinique|examen physique", faible: "examen" },
  { rubrique: "ecg", forte: "électrocardiogramme", faible: "ECG" },
  { rubrique: "autres", faible: "autres résultats|autres examens|autres" },
  { rubrique: "conclusion", forte: "en conclusion|conclusion|au total" },
  { rubrique: "conduite", forte: "conduite à tenir", faible: "CAT|traitement" },
];

function ranger(texte: string) {
  type Annonce = { debut: number; fin: number; rubrique: Rubrique };
  const trouvees: Annonce[] = [];
  for (const { rubrique, forte, faible } of ANNONCES) {
    for (const [mots, estForte] of [
      [forte, true],
      [faible, false],
    ] as const) {
      if (!mots) continue;
      const motif = new RegExp(String.raw`${D}(?:rubrique\s+)?(?:${mots})${F}\s*(:)?\s*`, "giu");
      for (const m of texte.matchAll(motif)) {
        // Pas de trimEnd() ici : il effacerait aussi le retour \u00e0 la ligne provisoire
        const enDebut = /(?:^|[.;:!?\u2028])[ \t]*$/.test(texte.slice(0, m.index));
        if (estForte || enDebut || m[1]) trouvees.push({ debut: m.index, fin: m.index + m[0].length, rubrique });
      }
    }
  }
  // Dans l'ordre du texte, sans chevauchement (« examen clinique » plutôt que « examen »)
  trouvees.sort((a, b) => a.debut - b.debut || b.fin - a.fin);
  const annonces = trouvees.filter((a, i) => !trouvees.slice(0, i).some((b) => a.debut < b.fin));

  const resultat = Object.fromEntries(rubriques.map((r) => [r, ""])) as Record<Rubrique, string>;
  const ajouter = (rubrique: Rubrique, contenu: string) => {
    const propre = mettreEnForme(contenu);
    if (propre) resultat[rubrique] = resultat[rubrique] ? `${resultat[rubrique]}\n${propre}` : propre;
  };
  let rubrique: Rubrique = "conclusion";
  let position = 0;
  for (const a of annonces) {
    ajouter(rubrique, texte.slice(position, a.debut));
    rubrique = a.rubrique;
    position = a.fin;
  }
  ajouter(rubrique, texte.slice(position));
  return resultat;
}

// Espaces, ponctuation et majuscules en début de phrase
function mettreEnForme(texte: string) {
  return texte
    .split(LIGNE)
    .map((ligne) =>
      ligne
        .replace(/\s+/g, " ")
        .replace(/\s+([.,])/g, "$1")
        .replace(/([.,;:])(?=\p{L})/gu, "$1 ")
        .replace(/^[\s.,;:]+|[\s,;:]+$/g, "")
        .replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, avant: string, lettre: string) => avant + lettre.toUpperCase()),
    )
    .filter(Boolean)
    .join("\n");
}

export function corrigerLocalement(brut: string, entreesLexique: { entendu: string; correct: string }[]): Correction {
  const incertains: Correction["incertains"] = [];
  const texte = medicamentsEcrits(siglesEcrits(lexique(commandes(brut), entreesLexique)), incertains);
  return {
    rubriques: ranger(texte),
    valeurs: valeursDictees(texte),
    incertains: incertains.filter((i, k) => incertains.findIndex((j) => j.entendu === i.entendu) === k),
  };
}

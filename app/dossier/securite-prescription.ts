// Vérifications affichées pendant la rédaction d'une ordonnance : allergie connue, même substance ou même famille
// prescrite deux fois, associations qui demandent réflexion. Ce sont des aides pour attirer l'attention : le médecin
// décide, et l'absence d'alerte ne prouve rien. Aucun accès à la base ici : module testable seul.

import { allergieConcernee, famillesDe, libelleFamille, normaliser } from "./cardio-medicaments";

export type LigneVerifiee = { medicament: string; dci?: string };
export type Avertissement = { niveau: "critique" | "attention"; texte: string; lignes: number[] };

// Associations à signaler (familles de cardio-medicaments.ts). Chaque règle est une mise en garde courante, à relire
// dans les recommandations de la bibliothèque avant de la considérer comme exacte pour le patient.
const ASSOCIATIONS: { a: string; b: string; niveau: "critique" | "attention"; texte: string }[] = [
  { a: "iec", b: "ara2", niveau: "attention", texte: "IEC et ARA II ensemble : association en général déconseillée (hyperkaliémie, insuffisance rénale)." },
  { a: "iec", b: "arni", niveau: "critique", texte: "IEC et sacubitril/valsartan : association contre-indiquée (angio-œdème), respecter un délai de 36 h." },
  { a: "ara2", b: "arni", niveau: "critique", texte: "ARA II et sacubitril/valsartan : le sacubitril/valsartan contient déjà un ARA II." },
  { a: "bb", b: "ica-ndhp", niveau: "critique", texte: "Bêtabloquant et diltiazem ou vérapamil : risque de bradycardie et de bloc auriculo-ventriculaire." },
  { a: "avk", b: "aod", niveau: "critique", texte: "Antivitamine K et anticoagulant oral direct : deux anticoagulants oraux." },
  { a: "avk", b: "hbpm", niveau: "attention", texte: "Antivitamine K et héparine : n'est normal que pendant un relais, avec contrôle de l'INR." },
  { a: "aod", b: "hbpm", niveau: "attention", texte: "Anticoagulant oral direct et héparine : cumul des anticoagulants." },
  { a: "arm", b: "iec", niveau: "attention", texte: "Antialdostérone avec IEC : surveiller kaliémie et créatinine." },
  { a: "arm", b: "ara2", niveau: "attention", texte: "Antialdostérone avec ARA II : surveiller kaliémie et créatinine." },
  { a: "antiarythmique", b: "bb", niveau: "attention", texte: "Antiarythmique et bêtabloquant : risque de bradycardie ou de trouble de conduction." },
  { a: "statine", b: "antiarythmique", niveau: "attention", texte: "Statine et amiodarone : certaines statines (simvastatine) voient leur dose limitée." },
];

const nomsDe = (l: LigneVerifiee) => `${l.medicament} ${l.dci ?? ""}`;

// Une même allergie s'écrit de plusieurs façons : « aspirine » ne retrouve pas « Kardégic » ni « acide
// acétylsalicylique » par simple comparaison de mots. Chaque groupe réunit des noms qui désignent la même substance
// ou la même famille d'allergie.
const SYNONYMES: string[][] = [
  ["aspirine", "acetylsalicylique", "kardegic", "aspegic", "aspirine"],
  ["penicilline", "amoxicilline", "ampicilline", "oxacilline", "augmentin", "clamoxyl", "bristopen"],
  ["sulfamide", "sulfamethoxazole", "bactrim", "cotrimoxazole"],
  ["iode", "iodee", "amiodarone", "cordarone"],
  ["ains", "ibuprofene", "diclofenac", "ketoprofene", "naproxene", "voltarene", "brufen"],
];

// Noms de la ligne, complétés des synonymes du groupe quand l'allergie ou la ligne en cite un
function nomsAvecSynonymes(l: LigneVerifiee, allergies: string) {
  const texte = normaliser(`${nomsDe(l)} ${allergies}`);
  const noms = [l.medicament, ...(l.dci ? [l.dci] : [])];
  for (const groupe of SYNONYMES) {
    if (groupe.some((m) => texte.includes(m)) && groupe.some((m) => normaliser(nomsDe(l)).includes(m))) noms.push(...groupe);
  }
  return noms;
}

export function verifierOrdonnance(lignes: LigneVerifiee[], allergies: string): Avertissement[] {
  const avertissements: Avertissement[] = [];
  const famillesParLigne = lignes.map((l) => famillesDe(normaliser(nomsDe(l))));

  // 1. Allergie ou intolérance notée au dossier
  if (allergies.trim()) {
    lignes.forEach((l, i) => {
      const touche = allergieConcernee(allergies, ...nomsAvecSynonymes(l, allergies));
      if (touche) avertissements.push({ niveau: "critique", texte: `Allergie notée au dossier (« ${touche} ») : ${l.medicament}.`, lignes: [i] });
    });
  }

  // 2. Même médicament prescrit deux fois (même premier mot : « bisoprolol 5 mg », « Bisoprolol 2,5 »)
  const premier = (m: string) => normaliser(m).match(/[a-z]{4,}/)?.[0] ?? "";
  const vus = new Map<string, number>();
  lignes.forEach((l, i) => {
    const mot = premier(l.medicament);
    if (!mot) return;
    if (vus.has(mot)) avertissements.push({ niveau: "attention", texte: `« ${l.medicament} » figure déjà sur l'ordonnance (ligne ${vus.get(mot)! + 1}).`, lignes: [vus.get(mot)!, i] });
    else vus.set(mot, i);
  });

  // 3. Deux médicaments de la même famille (hors association voulue), puis associations à signaler
  const parFamille = new Map<string, number[]>();
  famillesParLigne.forEach((fs, i) => fs.forEach((f) => parFamille.set(f, [...(parFamille.get(f) ?? []), i])));
  for (const [famille, indices] of parFamille) {
    const distincts = [...new Set(indices.map((i) => premier(lignes[i].medicament)))];
    if (indices.length > 1 && distincts.length > 1 && !["antiangineux", "antiagregant"].includes(famille)) {
      avertissements.push({ niveau: "attention", texte: `Deux médicaments de la même famille (${libelleFamille(famille)}) : ${indices.map((i) => lignes[i].medicament).join(" et ")}.`, lignes: indices });
    }
  }
  for (const r of ASSOCIATIONS) {
    const a = parFamille.get(r.a);
    const b = parFamille.get(r.b);
    if (a && b) avertissements.push({ niveau: r.niveau, texte: r.texte, lignes: [...new Set([...a, ...b])] });
  }
  return avertissements.sort((x, y) => (x.niveau === y.niveau ? 0 : x.niveau === "critique" ? -1 : 1));
}

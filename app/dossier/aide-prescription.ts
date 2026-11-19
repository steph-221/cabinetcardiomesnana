// Aide à la prescription : situations cliniques repérées dans la consultation en cours (texte des rubriques,
// constantes, mesures, antécédents), puis familles et substances à envisager avec leur posologie usuelle.
// INFORMATION SEULEMENT : rien n'est ajouté à l'ordonnance sans le médecin, qui seul connaît le patient.
// Sans accès à la base : testable seul (la recherche des produits est dans aide-prescription-produits.ts).

import { familles, famillesDe, normaliser, repereDe, reperes, situations } from "./cardio-medicaments";

export type Contexte = {
  rubriques: { source: string; texte: string }[]; // motif, examen, ECG, autres, conclusion, antécédents…
  taSys: number | null;
  taDia: number | null;
  fc: number | null;
  fevg: number | null;
  ldl: number | null; // g/L
  allergies: string;
  traitements: string[]; // médicaments en cours
};

export type SituationDetectee = { cle: string; libelle: string; raisons: string[] };

// Signes cherchés dans le texte (sans accents ni casse) ; un signe nié (« pas de », « absence de »…) ne compte pas
const signes: Record<string, RegExp> = {
  hta: /\bhta\b|hypertension arterielle|hypertendu|hypertension\b(?! pulmonaire)/g,
  "ic-reduite": /insuffisance cardiaque|\bic\b|\bicfer\b|cardiomyopathie dilatee|\bcmd\b|fevg (?:alteree|reduite|effondree)|dysfonction (?:systolique|ventriculaire)/g,
  congestion: /oedemes?|surcharge|congestion|orthopnee|crepitants|\bohmi\b|prise de poids/g,
  angor: /angor|douleur thoracique|precordialgie|ischemie|coronaropathie|stenose coronaire|dyspnee d.effort/g,
  "post-sca": /infarctus|\bidm\b|\bsca\b|stent|angioplastie|syndrome coronarien|pontage/g,
  "fa-anticoag": /fibrillation (?:atriale|auriculaire)|\bacfa\b|\bfa\b|flutter/g,
  rythme: /palpitations?|extrasystoles?|tachycardie|\btsv\b|\btv\b|tachyarythmie/g,
  dyslipidemie: /dyslipid[a-z]*|hypercholesterol[a-z]*|hyperlipid[a-z]*|\bldl\b/g,
  "thrombose-veineuse": /\btvp\b|embolie pulmonaire|phlebite|thrombose veineuse|\bmtev\b/g,
  "prevention-arterielle": /\baomi\b|arteriopathie|\bavc\b|\bait\b|atherome|claudication|plaque carotidienne/g,
  htap: /\bhtap\b|hypertension pulmonaire/g,
  veineux: /insuffisance veineuse|jambes lourdes|varices?/g,
};

const NEGATION = /(?:\bpas d[e' ]|\bpas de\b|\babsence d|\bsans\b|\baucun|\bn'a pas|\bnie\b|\bexclu|\bpas de signe|\bpas d')[^.;\n]{0,25}$/;

function trouver(texte: string, re: RegExp): string | null {
  for (const m of texte.matchAll(re)) {
    const avant = texte.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    const phrase = avant.split(/[.;\n]/).pop() ?? "";
    if (!NEGATION.test(phrase)) return m[0];
  }
  return null;
}

export function detecterSituations(c: Contexte): SituationDetectee[] {
  const trouvees = new Map<string, string[]>();
  const ajouter = (cle: string, raison: string) => trouvees.set(cle, [...(trouvees.get(cle) ?? []), raison]);

  for (const { source, texte } of c.rubriques) {
    const t = normaliser(texte);
    for (const [cle, re] of Object.entries(signes)) {
      const m = trouver(t, new RegExp(re.source, "g"));
      if (m) ajouter(cle, `« ${m} » (${source})`);
    }
  }
  if ((c.taSys ?? 0) >= 140 || (c.taDia ?? 0) >= 90) ajouter("hta", `TA ${c.taSys ?? "?"}/${c.taDia ?? "?"} mmHg`);
  if (c.fevg !== null && c.fevg <= 40) ajouter("ic-reduite", `FEVG ${c.fevg} %`);
  if (c.ldl !== null && c.ldl >= 1) ajouter("dyslipidemie", `LDL ${c.ldl} g/L`);
  if (trouvees.has("fa-anticoag")) {
    trouvees.set("fa-frequence", [...(c.fc !== null && c.fc >= 110 ? [`FC ${c.fc}/min`] : []), "fibrillation atriale"]);
  }
  // Une insuffisance cardiaque retenue sur le seul texte « IC » sans FEVG connue : à confirmer par le médecin
  return situations
    .filter((s) => trouvees.has(s.cle))
    .map((s) => ({ cle: s.cle, libelle: s.libelle, raisons: [...new Set(trouvees.get(s.cle))].slice(0, 4) }));
}

export type Produit = { nom: string; url: string; ppv: string; generique: boolean };

export type Proposition = {
  dci: string;
  posologie: string | null;
  attention: string | null;
  dejaPris: boolean; // la substance figure déjà dans les traitements en cours
  allergie: string | null; // mot de l'allergie notée qui correspond
  produits: Produit[];
};

export type GroupeFamille = { cle: string; libelle: string; propositions: Proposition[] };
export type Suggestion = SituationDetectee & { groupes: GroupeFamille[] };

// Substances à envisager pour une famille : celles qui ont un repère de posologie, dans l'ordre du tableau
export function substancesDeFamille(cle: string): string[] {
  return reperes.filter((r) => famillesDe(r.dci).includes(cle)).map((r) => r.dci);
}

export function composer(
  detectees: SituationDetectee[],
  c: Pick<Contexte, "allergies" | "traitements">,
  produitsDe: (dci: string) => Produit[],
  allergie: (allergies: string, ...noms: string[]) => string | null,
): Suggestion[] {
  const enCours = normaliser(c.traitements.join(" | "));
  return detectees.map((s) => {
    const def = situations.find((x) => x.cle === s.cle)!;
    const groupes = def.familles
      .map((fc) => {
        const f = familles.find((x) => x.cle === fc)!;
        const propositions = substancesDeFamille(fc).map((dci): Proposition => {
          const r = repereDe(dci);
          // « acide acetylsalicylique » et « aspirine » désignent la même substance
          const alias = dci === "acide acetylsalicylique" ? ["acide acetylsalicylique", "aspirine", "kardegic"] : [dci];
          return {
            dci,
            posologie: r?.posologie ?? null,
            attention: r?.attention ?? null,
            dejaPris: alias.some((a) => enCours.includes(normaliser(a))),
            allergie: allergie(c.allergies, dci),
            produits: produitsDe(dci),
          };
        });
        return { cle: fc, libelle: f.libelle, propositions };
      })
      .filter((g) => g.propositions.length);
    return { ...s, groupes };
  });
}

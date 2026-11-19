// Ordonnance dictée : « bisoprolol 5 mg, un comprimé le matin, trois mois, à la ligne, … » devient des lignes
// médicament / posologie / durée. Découpage par règles, gratuit et fait dans le navigateur ; le médecin relit
// chaque ligne avant d'enregistrer. Aucun accès à la base ici : module testable seul.

import { corrigerTexte } from "./correction-locale";

export type LigneDictee = {
  medicament: string;
  posologie: string;
  duree: string;
  // Ligne à relire de près : médicament ou posologie manquants, ou découpage incertain
  douteux: boolean;
};

// Limites de mot qui reconnaissent les lettres accentuées (« \b » ne connaît que l'anglais)
const D = String.raw`(?<![\p{L}\d])`;
const F = String.raw`(?![\p{L}\d])`;

const CHIFFRES: Record<string, string> = {
  "un demi": "½",
  "une demie": "½",
  "une demi": "½",
  demi: "½",
  "un quart": "¼",
  un: "1",
  une: "1",
  deux: "2",
  trois: "3",
  quatre: "4",
  cinq: "5",
  six: "6",
  sept: "7",
  huit: "8",
  neuf: "9",
  dix: "10",
  douze: "12",
  quinze: "15",
  vingt: "20",
  trente: "30",
};
// Les plus longs d'abord, pour que « un demi » passe avant « un »
const MOTS_NOMBRES = Object.keys(CHIFFRES).sort((a, b) => b.length - a.length).join("|");
const NOMBRE = String.raw`(?:\d+(?:[.,]\d+)?|½|¼|1\/2|1\/4|${MOTS_NOMBRES})`;
const FORME = String.raw`(?:comprimés?|cps?|gélules?|sachets?|ampoules?|gouttes?|bouffées?|cuillères?(?: à (?:café|soupe))?|injections?|unités?|patchs?|applications?|suppositoires?|doses?|mesures?)`;

// Début de la posologie : une quantité suivie d'une forme (« un comprimé », « 2 gélules », « un quart de comprimé »),
// ou un moment de prise (« le matin », « 2 fois par jour », « si besoin »…)
const DEBUT_POSOLOGIE = new RegExp(
  [
    String.raw`${D}${NOMBRE}\s*(?:de\s+)?${FORME}${F}`,
    String.raw`${D}${NOMBRE}\s*fois${F}`,
    String.raw`${D}(?:le |au |chaque |à )?(?:matin|midi|soir|coucher|réveil)${F}`,
    String.raw`${D}(?:par jour|par semaine|tous les|toutes les|si besoin|en cas de|à jeun|pendant le repas|au cours du repas)${F}`,
  ].join("|"),
  "iu",
);

const DUREE = new RegExp(
  String.raw`(?:${D}(?:pendant|durant|pour|durée(?: de)?|qsp|quantité suffisante pour)\s+)?${D}(${NOMBRE})\s*(jours?|semaines?|mois|ans?|années?)${F}`,
  "giu",
);
const DUREE_LIBRE = new RegExp(String.raw`${D}(?:au long cours|à vie|en continu|au long terme)${F}`, "iu");
// « tous les 2 jours », « 3 fois par semaine », « 1 jour sur 2 » : une fréquence, pas une durée
const FREQUENCE_AVANT = new RegExp(String.raw`${D}(?:tous les|toutes les|chaque|par|fois par)\s*$`, "iu");
const FREQUENCE_APRES = /^\s*sur\s+\d/iu;

const MARQUE_DE_LISTE = new RegExp(
  String.raw`^(?:[-–•]\s*|\d+\s*[.)]\s+|numéro \d+\s*|premièrement\s*|deuxièmement\s*|troisièmement\s*|et\s+)`,
  "iu",
);

const net = (t: string) => t.replace(/\s+/g, " ").replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "");

// « un comprimé » → « 1 comprimé », « trois mois » → « 3 mois » : seulement devant une forme, « fois » ou une durée
const enChiffres = (t: string) =>
  t.replace(
    new RegExp(String.raw`${D}(${MOTS_NOMBRES})(?=\s+(?:de\s+)?(?:${FORME}|fois|jours?|semaines?|mois|ans?|années?)${F})`, "giu"),
    (mot) => CHIFFRES[mot.toLowerCase()] ?? mot,
  );

function lireLigne(brut: string): LigneDictee | null {
  let reste = net(brut).replace(MARQUE_DE_LISTE, "");
  if (!reste) return null;

  // Durée : la dernière qui n'est pas une fréquence, retirée du texte
  let duree = "";
  const libre = DUREE_LIBRE.exec(reste);
  const candidates = [...reste.matchAll(DUREE)].filter(
    (m) => !FREQUENCE_AVANT.test(reste.slice(0, m.index)) && !FREQUENCE_APRES.test(reste.slice(m.index + m[0].length)),
  );
  const derniere = candidates.at(-1);
  if (derniere) {
    duree = enChiffres(`${derniere[1]} ${derniere[2]}`).toLowerCase();
    reste = net(reste.slice(0, derniere.index) + " " + reste.slice(derniere.index + derniere[0].length));
  } else if (libre) {
    duree = libre[0].toLowerCase();
    reste = net(reste.slice(0, libre.index) + " " + reste.slice(libre.index + libre[0].length));
  }

  const debut = DEBUT_POSOLOGIE.exec(reste);
  const medicament = net(debut ? reste.slice(0, debut.index) : reste);
  const posologie = debut ? enChiffres(net(reste.slice(debut.index))) : "";
  return {
    medicament: medicament ? medicament[0].toUpperCase() + medicament.slice(1) : "",
    posologie,
    duree,
    douteux: !medicament || !posologie || medicament.split(" ").length > 6,
  };
}

// Texte déjà corrigé (ponctuation et retours à la ligne en place) → lignes d'ordonnance
export function decouperOrdonnance(texte: string): LigneDictee[] {
  return texte
    .split(new RegExp(String.raw`\n+|;|\.\s+(?=\p{L})|${D}(?:puis|ensuite)${F}`, "iu"))
    .map(lireLigne)
    .filter((l): l is LigneDictee => l !== null)
    .slice(0, 30);
}

// Dictée brute du navigateur → lignes d'ordonnance (commandes « à la ligne », lexique, noms de médicaments corrigés)
export function lireOrdonnanceDictee(brut: string, lexique: { entendu: string; correct: string }[]) {
  const { texte, incertains } = corrigerTexte(brut, lexique);
  return { lignes: decouperOrdonnance(texte), incertains };
}

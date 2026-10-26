// Découpage du texte d'une source en passages d'environ un paragraphe, sans couper les phrases.
// Chaque passage garde son numéro de page, pour que l'assistant puisse renvoyer à la bonne page.
// Aucun accès à la base ici : module testable seul.

export const TAILLE_PASSAGE = 1200;
const TAILLE_MIN = 200;

// Nettoie le texte extrait d'un PDF : césures de fin de ligne, espaces multiples, caractères de contrôle
export function nettoyer(texte: string) {
  return texte
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Phrases (ou lignes de tableau), dans l'ordre. Un point après une abréviation courante ne coupe pas.
function phrases(texte: string) {
  const morceaux = texte.split(/(?<=[.!?;:])\s+(?=[\p{Lu}\d•–-])|\n+/u);
  return morceaux.map((m) => m.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function decouper(texte: string, taille = TAILLE_PASSAGE): string[] {
  const passages: string[] = [];
  let courant = "";
  for (let phrase of phrases(nettoyer(texte))) {
    // Une « phrase » trop longue (tableau mis à plat) est coupée sur un espace
    while (phrase.length > taille) {
      const coupe = phrase.lastIndexOf(" ", taille);
      const n = coupe > taille / 2 ? coupe : taille;
      if (courant) passages.push(courant);
      courant = "";
      passages.push(phrase.slice(0, n).trim());
      phrase = phrase.slice(n).trim();
    }
    if (courant && courant.length + phrase.length + 1 > taille) {
      passages.push(courant);
      courant = "";
    }
    courant = courant ? `${courant} ${phrase}` : phrase;
  }
  if (courant) {
    // Un reste trop court est rattaché au passage précédent
    if (courant.length < TAILLE_MIN && passages.length && passages.at(-1)!.length + courant.length < taille * 1.3) {
      passages[passages.length - 1] += ` ${courant}`;
    } else passages.push(courant);
  }
  return passages;
}

// Requête de recherche plein texte (syntaxe de websearch_to_tsquery) : les termes sont reliés par « or »,
// les expressions de plusieurs mots restent groupées.
export function requeteRecherche(termes: string[]) {
  const propres = [
    ...new Set(
      termes
        .map((t) => t.replace(/["()]/g, " ").replace(/\s+/g, " ").trim().toLowerCase())
        .filter((t) => t.length > 1 && t !== "or"),
    ),
  ].slice(0, 30);
  return propres.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" or ");
}

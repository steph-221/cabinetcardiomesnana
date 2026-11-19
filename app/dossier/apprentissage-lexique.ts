// Le lexique apprend des corrections : quand le médecin retouche à la main un mot que la dictée vient d'écrire,
// le couple « mot entendu → mot juste » lui est proposé pour le lexique. Comparaison mot à mot entre le texte tel
// que la dictée l'a laissé et le texte enregistré. Aucun accès à la base : module testable seul.

export type Proposition = { entendu: string; correct: string };

const mots = (texte: string) => texte.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu) ?? [];
const cle = (mot: string) => mot.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Nombre de lettres à changer, ajouter ou retirer pour passer d'un mot à l'autre
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

// Un mot mal reconnu ressemble au mot juste (« sin trome » → « Sintrom ») ; un mot remplacé par un autre, non
const ressemble = (entendu: string, correct: string) => {
  const [x, y] = [cle(entendu).replace(/[\s'’.-]/g, ""), cle(correct).replace(/[\s'’.-]/g, "")];
  return distance(x, y) <= Math.max(x.length, y.length) / 2;
};

// Plus longue suite commune de mots, pour repérer ce qui a été remplacé
function alignement(a: string[], b: string[]) {
  const n = a.length;
  const m = b.length;
  const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) t[i][j] = cle(a[i]) === cle(b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  }
  const blocs: { retires: string[]; ajoutes: string[] }[] = [];
  let courant = { retires: [] as string[], ajoutes: [] as string[] };
  const clore = () => {
    if (courant.retires.length || courant.ajoutes.length) blocs.push(courant);
    courant = { retires: [], ajoutes: [] };
  };
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && cle(a[i]) === cle(b[j])) {
      clore();
      i++;
      j++;
    } else if (j < m && (i === n || t[i][j + 1] >= t[i + 1][j])) courant.ajoutes.push(b[j++]);
    else courant.retires.push(a[i++]);
  }
  clore();
  return { blocs, communs: t[0][0] };
}

// Remplacements d'un à trois mots par un à trois mots : une correction d'orthographe ou de terme, pas une réécriture.
// Les simples changements de majuscule ou d'accent ne sont pas proposés.
// `proteges` : formes (sans accents, en minuscules) à ne jamais proposer comme mot « mal entendu ».
export function correctionsApportees(
  dicte: string,
  enregistre: string,
  max = 5,
  proteges: ReadonlySet<string> = new Set(),
): Proposition[] {
  const [a, b] = [mots(dicte), mots(enregistre)];
  // Textes trop longs ou trop différents : rien à apprendre de fiable
  if (!a.length || !b.length || a.length > 600 || b.length > 600) return [];
  const { blocs, communs } = alignement(a, b);
  // Texte en grande partie réécrit : ce ne sont plus des corrections de mots
  if (communs < Math.max(a.length, b.length) * 0.6) return [];
  const propositions: Proposition[] = [];
  for (const { retires, ajoutes } of blocs) {
    if (!retires.length || !ajoutes.length || retires.length > 3 || ajoutes.length > 3) continue;
    const entendu = retires.join(" ");
    const correct = ajoutes.join(" ");
    if (cle(entendu) === cle(correct) || !/\p{L}{2,}/u.test(entendu) || !/\p{L}{2,}/u.test(correct)) continue;
    // Un chiffre remplacé par un autre est une valeur corrigée, pas un mot mal reconnu
    if (/^\d/.test(entendu) && /^\d/.test(correct)) continue;
    if (!ressemble(entendu, correct) || proteges.has(cle(entendu))) continue;
    if (!propositions.some((p) => cle(p.entendu) === cle(entendu))) propositions.push({ entendu, correct });
  }
  return propositions.slice(0, max);
}

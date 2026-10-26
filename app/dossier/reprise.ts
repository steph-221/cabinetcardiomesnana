// Reprise des comptes rendus Word du cabinet : l'identité du patient est lue ici, sans IA, d'après les modèles du
// cabinet (« NOM : PRENOM : », « DATE DE NAISSANCE : », « Malade : … Age : … Date : … »). Le nom, la date de naissance
// et les téléphones sont ensuite masqués : seul le texte masqué est envoyé à Claude pour en extraire le contenu
// médical. Aucun accès à la base ici (module testable seul).

export type IdentiteLue = {
  nom: string;
  prenom: string;
  naissance: string | null; // AAAA-MM-JJ
  age: number | null; // âge écrit dans le compte rendu (ETT)
  dateDocument: string | null; // AAAA-MM-JJ
};

const sansAccents = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const capitaliser = (t: string) =>
  t.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, avant: string, l: string) => avant + l.toUpperCase());

// « 06/09/2024 », « 2/12/24 » → « 2024-09-06 », « 2024-12-02 » ; null si la date n'existe pas
export function dateFrancaise(t: string): string | null {
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return null;
  const [j, mo] = [Number(m[1]), Number(m[2])];
  const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return null;
  return `${a}-${String(mo).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

// Sépare nom et prénom. Les fichiers du cabinet sont nommés « nom_prenom » : l'ordre du nom de fichier l'emporte
// s'il contient tous les mots ; sinon le dernier mot est le prénom (« Malade : BEN HSSAIN ABDESLAM »).
export function separerNom(complet: string, nomFichier: string) {
  const mots = complet.split(/\s+/).filter(Boolean);
  if (mots.length < 2) return { nom: capitaliser(mots[0] ?? ""), prenom: "" };
  const fichier = sansAccents(nomFichier.replace(/\.[^.]*$/, ""))
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  const positions = mots.map((m) => fichier.indexOf(sansAccents(m)));
  const ordre = positions.every((p) => p >= 0)
    ? [...mots].sort((a, b) => fichier.indexOf(sansAccents(a)) - fichier.indexOf(sansAccents(b)))
    : mots;
  return { nom: capitaliser(ordre.slice(0, -1).join(" ")), prenom: capitaliser(ordre.at(-1)!) };
}

export function identiteLocale(texte: string, nomFichier: string): IdentiteLue {
  const lignes = texte.split("\n");
  let complet = "";
  let naissance: string | null = null;
  let age: number | null = null;
  let dateDocument: string | null = null;

  for (const l of lignes) {
    const consultation = l.match(/^\s*NOM\s*:?\s*(?:ET\s+)?PR[ÉE]NOMS?\s*:?\s*\|\s*(.+)$/i);
    if (consultation && !complet) complet = consultation[1].replace(/\|/g, " ");
    const nomSeul = l.match(
      /^\s*(?:NOM(?:\s+ET\s+PR[ÉE]NOMS?)?|Malade|Patient(?:e)?)\s*:\s*(.+?)(?=\s+(?:Age|Âge)\s*:|\s+Date\s*:|$)/i,
    );
    if (nomSeul && !complet && !/PR[ÉE]NOM\s*:/i.test(l)) complet = nomSeul[1];
    const ne = l.match(/DATE\s+DE\s+NAISSANCE\s*:?\s*\|?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i);
    if (ne && !naissance) naissance = dateFrancaise(ne[1]);
    const a = l.match(/\b(?:Age|Âge)\s*:\s*(\d{1,3})\s*ans/i);
    if (a && age === null) age = Number(a[1]);
    const d = l.match(/DATE\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i);
    if (d && !dateDocument && !/naissance/i.test(l)) dateDocument = dateFrancaise(d[1]);
  }
  complet = complet
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { ...separerNom(complet, nomFichier), naissance, age, dateDocument };
}

const echapper = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Remplace le nom, le prénom, la date de naissance et les numéros de téléphone avant l'envoi à Claude
export function masquer(texte: string, identite: Pick<IdentiteLue, "nom" | "prenom" | "naissance">) {
  let t = texte;
  const mots = `${identite.nom} ${identite.prenom}`
    .split(/[\s'-]+/)
    .filter((m) => m.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const mot of mots) {
    // Sans tenir compte des accents ni de la casse
    const motif = [...mot.normalize("NFD").replace(/\p{M}/gu, "")]
      .map((c) => (/\p{L}/u.test(c) ? `${echapper(c)}\\p{M}*` : echapper(c)))
      .join("");
    t = t.normalize("NFD").replace(new RegExp(`(?<![\\p{L}\\p{M}])${motif}(?![\\p{L}\\p{M}])`, "giu"), "[PATIENT]");
    t = t.normalize("NFC");
  }
  if (identite.naissance) {
    const [a, m, j] = identite.naissance.split("-");
    const date = new RegExp(`\\b0?${Number(j)}[/.-]0?${Number(m)}[/.-](?:${a}|${a.slice(2)})\\b`, "g");
    t = t.replace(date, "[NAISSANCE]");
  }
  t = t.replace(/(?:\+212|00212|\b0)[\s.-]?[5-7](?:[\s.-]?\d){8}\b/g, "[TÉLÉPHONE]");
  return t.replace(/\[PATIENT\](?:\s+\[PATIENT\])+/g, "[PATIENT]");
}

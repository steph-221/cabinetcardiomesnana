// Regroupement des comptes rendus repris : plusieurs fichiers d'un même patient (consultations et échographies de
// dates différentes, copies « (1) », noms écrits dans un autre ordre ou avec une faute de frappe) vont dans un seul
// dossier. Une fusion n'est jamais faite en silence : elle est « sûre » (même nom, mêmes mots) ou « probable »
// (faute de frappe) et reste à confirmer par le médecin. Aucun accès à la base (module testable seul).

import type { IdentiteLue } from "./reprise";

const sansAccents = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Mots du nom complet, sans accents ni ponctuation, triés : « Fatima Zahrae EL OUAZZANI » = « el ouazzani fatima zahrae »
export function motsNom(nom: string, prenom: string) {
  return sansAccents(`${nom} ${prenom}`)
    .split(/[^a-z]+/)
    .filter(Boolean)
    .sort();
}

export function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export type Similitude = "identique" | "probable" | "different";

// Deux noms sont « probables » si tous les mots se correspondent à une faute de frappe près (une lettre pour un mot
// d'au moins 5 lettres, deux à partir de 6) et qu'au moins un mot est strictement identique (« Fatima Ahmadi » et
// « Fatiha Ahmadi » restent donc à confirmer par le médecin). « benajiba youssef » et « benajiba rahma » restent différents : deux prénoms distincts.
export function comparerNoms(a: IdentiteLue, b: IdentiteLue): Similitude {
  const x = motsNom(a.nom, a.prenom);
  const y = motsNom(b.nom, b.prenom);
  if (!x.length || !y.length) return "different";
  if (x.join(" ") === y.join(" ")) return "identique";
  if (x.length !== y.length) return "different";
  // Les mots triés peuvent se décaler après une faute (« hachti » / « hadchi ») : on apparie chaque mot au plus proche
  if (!x.some((m) => y.includes(m))) return "different";
  const proche = (m: string, r: string) => {
    const court = Math.min(m.length, r.length);
    return court >= 5 && distance(m, r) <= (court >= 6 ? 2 : 1);
  };
  const restants = [...y];
  for (const m of x) {
    const i = restants.findIndex((r) => r === m || proche(m, r));
    if (i < 0) return "different";
    restants.splice(i, 1);
  }
  return "probable";
}

// Deux dossiers de même nom ne sont pas le même patient si leurs dates de naissance ou leurs âges sont incompatibles
export function incompatibles(a: IdentiteLue, b: IdentiteLue) {
  if (a.naissance && b.naissance) return a.naissance !== b.naissance;
  if (a.age !== null && b.age !== null) return Math.abs(a.age - b.age) > 2;
  return false;
}

export type Element = { id: number; nomFichier: string; identite: IdentiteLue };
export type Groupe = { elements: Element[]; certitude: "sure" | "probable" };

export function regrouper(elements: Element[]): Groupe[] {
  const groupes: Groupe[] = [];
  for (const e of elements) {
    let cible: Groupe | null = null;
    let certitude: Groupe["certitude"] = "sure";
    for (const g of groupes) {
      const rangs = g.elements.map((m) => (incompatibles(m.identite, e.identite) ? "different" : comparerNoms(m.identite, e.identite)));
      if (rangs.includes("different")) continue;
      cible = g;
      certitude = rangs.includes("probable") ? "probable" : "sure";
      break;
    }
    if (cible) {
      cible.elements.push(e);
      if (certitude === "probable") cible.certitude = "probable";
    } else groupes.push({ elements: [e], certitude: "sure" });
  }
  return groupes;
}

// --- Nom de fichier : modèle vierge, copie, genre de document ---

export type GenreFichier = "modele_vierge" | "ett" | "eto" | "consultation" | "inconnu";

// Les modèles vierges du cabinet (fiche de consultation vide, feuille de rendez-vous) ne sont pas des patients
export function genreDepuisNom(nomFichier: string): GenreFichier {
  const n = sansAccents(nomFichier);
  if (/vierge|rendez-vous|\bdate \(\d\)|^consultation dr/.test(n)) return "modele_vierge";
  if (/\beto\b|transoeso/.test(n)) return "eto";
  if (/\bett\b|echo|thrombose/.test(n)) return "ett";
  if (/\bcs\b|\bcst\b|consult|preop|post ?op|tsa/.test(n)) return "consultation";
  return "inconnu";
}

// « nom (1).docx », « nom (2).docx », « nom.docx 2.docx », « nom2.docx » : copie ou version d'un autre fichier
export const estCopie = (nomFichier: string) => /\(\d\)\s*\.[a-z]+$|\.docx? \d\.docx$|[a-z]\d\.[a-z]+$/i.test(nomFichier.trim());

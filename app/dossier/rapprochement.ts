// Repère, dans l'objet, le nom du fichier et le texte d'un email de laboratoire, le patient concerné.
// Prudent : un seul dossier « sûr » (nom ET prénom présents) est classé tout seul ; au moindre doute,
// le résultat attend dans « À classer » avec les dossiers possibles.

export const normaliser = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();

const mots = (texte: string) => normaliser(texte).split(" ").filter((m) => m.length >= 2);

export type Nom = { id: number; nom: string; prenom: string };

export function patientsCites(texte: string, patients: Nom[]): { surs: number[]; possibles: number[] } {
  const presents = new Set(mots(texte));
  const surs: number[] = [];
  const possibles: number[] = [];
  for (const p of patients) {
    const nom = mots(p.nom);
    const prenom = mots(p.prenom);
    if (!nom.length || !nom.every((m) => presents.has(m))) continue;
    if (prenom.length && prenom.every((m) => presents.has(m))) surs.push(p.id);
    else possibles.push(p.id); // le nom seul est cité : proposé, jamais classé tout seul
  }
  return { surs, possibles };
}

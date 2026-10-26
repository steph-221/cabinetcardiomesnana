// Texte d'un fichier Word (.docx), lu dans le navigateur : les paragraphes deviennent des lignes, chaque ligne de
// tableau une ligne « cellule | cellule ». Aucun accès au serveur ici (module testable seul).

import { strFromU8, unzipSync } from "fflate";

const entites: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decoder = (t: string) =>
  t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : (entites[e] ?? m),
  );

// Transforme le XML du document en lignes de texte
export function texteDocumentXml(xml: string) {
  const lignes: string[] = [];
  let paragraphe = "";
  // Pile des tableaux en cours : lignes, cellules de la ligne, paragraphes de la cellule
  const tableaux: { cellules: string[]; cellule: string[] }[] = [];
  const balise = /<(\/?)w:(p|tbl|tr|tc|t|tab|br|cr)\b[^>]*?(\/?)>|([^<]+)/g;
  let dansTexte = false;
  for (const m of xml.matchAll(balise)) {
    const [, fin, nom, auto, texte] = m;
    if (texte !== undefined) {
      if (dansTexte) paragraphe += decoder(texte);
      continue;
    }
    const t = tableaux.at(-1);
    if (nom === "t") dansTexte = !fin && !auto;
    else if (nom === "tab" && !fin) paragraphe += " ";
    else if ((nom === "br" || nom === "cr") && !fin) paragraphe += t ? " " : "\n";
    else if (nom === "p" && (fin || auto)) {
      const p = paragraphe.replace(/[ \t ]+/g, " ").trim();
      paragraphe = "";
      if (t) t.cellule.push(p);
      else if (p) lignes.push(...p.split("\n").map((l) => l.trim()));
    } else if (nom === "tbl") {
      if (!fin) tableaux.push({ cellules: [], cellule: [] });
      else tableaux.pop();
    } else if (nom === "tc" && t) {
      if (fin) {
        t.cellules.push(t.cellule.filter(Boolean).join(" "));
        t.cellule = [];
      }
    } else if (nom === "tr" && t) {
      if (!fin) t.cellules = [];
      else {
        const ligne = t.cellules.join(" | ").trim();
        // Un tableau dans un tableau est rendu à plat dans la cellule qui le contient
        const parent = tableaux.at(-2);
        if (parent) parent.cellule.push(ligne);
        else if (ligne.replace(/\|/g, "").trim()) lignes.push(ligne);
      }
    }
  }
  return lignes.filter((l) => l.trim()).join("\n");
}

export class FichierIllisible extends Error {}

export function texteWord(contenu: Uint8Array) {
  // Un .doc (Word 97-2003) n'est pas un fichier zip : il faut l'enregistrer au format .docx
  if (contenu[0] !== 0x50 || contenu[1] !== 0x4b) throw new FichierIllisible("format");
  let fichiers: Record<string, Uint8Array>;
  try {
    fichiers = unzipSync(contenu, { filter: (f) => f.name === "word/document.xml" });
  } catch {
    throw new FichierIllisible("zip");
  }
  const xml = fichiers["word/document.xml"];
  if (!xml) throw new FichierIllisible("document");
  return texteDocumentXml(strFromU8(xml));
}

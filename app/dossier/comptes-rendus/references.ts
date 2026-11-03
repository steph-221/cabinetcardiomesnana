// Références citées dans un « AU TOTAL » : chaque proposition ajoutée porte un repère [1], [2]… et le compte rendu
// se termine par la liste des références (document, page, phrase citée). Aucun accès à la base ici.

import { trouverSeuil, type ReferenceSeuil } from "./seuils";

// Ligne de référence : le document et la page trouvés dans la bibliothèque, sinon la source citée par l'application
export function ligneReference(seuilId: string, ref?: ReferenceSeuil | null) {
  const seuil = trouverSeuil(seuilId);
  if (ref?.sourceTitre && ref.citation) {
    return `${ref.sourceTitre}${ref.page ? `, p. ${ref.page}` : ""} : « ${ref.citation} »${
      ref.valide === "conforme" ? ` (validé par ${ref.validePar})` : " (non validé)"
    }`;
  }
  return `${seuil?.source ?? seuilId} (passage non retrouvé dans la bibliothèque, non validé)`;
}

// Ajoute une proposition au texte, avec le repère de chacune de ses références
export function ajouterProposition(total: string, utilisees: string[], p: { texte: string; seuils?: string[] }) {
  const suivantes = [...utilisees];
  const numeros = (p.seuils ?? []).map((id) => {
    let i = suivantes.indexOf(id);
    if (i < 0) i = suivantes.push(id) - 1;
    return i + 1;
  });
  const ligne = numeros.length ? `${p.texte} [${numeros.join(", ")}]` : p.texte;
  return { total: total.trim() ? `${total.trim()}\n${ligne}` : ligne, utilisees: suivantes };
}

// Références dont le repère figure encore dans le texte (le médecin a pu en retirer), numérotées comme dans le texte
export function referencesCitees(total: string, utilisees: string[], refs: Record<string, ReferenceSeuil | undefined>) {
  const repères = [...total.matchAll(/\[(\d+(?:, \d+)*)\]/g)].flatMap((m) => m[1].split(", ").map(Number));
  return utilisees.flatMap((id, i) => (repères.includes(i + 1) ? [`[${i + 1}] ${ligneReference(id, refs[id])}`] : []));
}

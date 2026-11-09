// Produits disponibles (medicament.ma) pour une substance : quelques marques, les moins chères d'abord

import { normaliser } from "./cardio-medicaments";
import { medicaments } from "./medicaments-ma";
import type { Produit } from "./aide-prescription";

const association = (dci: string) => /[+,;|/]|\bet\b|\bavec\b/.test(normaliser(dci));

export async function produitsParSubstance(): Promise<(dci: string) => Produit[]> {
  const { liste } = await medicaments();
  const cache = new Map<string, Produit[]>();
  return (dci) => {
    const cle = normaliser(dci);
    const dejaFait = cache.get(cle);
    if (dejaFait) return dejaFait;
    const marques = new Map<string, (typeof liste)[number]>();
    for (const m of liste) {
      if (m.statut && !/commerc/i.test(m.statut)) continue;
      const d = normaliser(m.dci);
      if (!d.includes(cle) || association(m.dci)) continue;
      // Formes orales d'abord (l'injectable ne se retrouve que s'il n'y a rien d'autre)
      if (m.forme === "injectable" && cle !== "enoxaparine" && cle !== "heparine") continue;
      const marque = normaliser(m.nom.split(/[\s,]/)[0]);
      const actuel = marques.get(marque);
      if (!actuel || (m.prix ?? Infinity) < (actuel.prix ?? Infinity)) marques.set(marque, m);
    }
    const produits = [...marques.values()]
      .sort((a, b) => Number(a.generique) - Number(b.generique) || (a.prix ?? Infinity) - (b.prix ?? Infinity))
      .slice(0, 4)
      .map((m) => ({ nom: m.nom, url: m.url, ppv: m.ppv, generique: m.generique }));
    cache.set(cle, produits);
    return produits;
  };
}

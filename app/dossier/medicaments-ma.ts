// Base publique des médicaments du Maroc (medicament.ma) : recherche pour l'ordonnance.
// Les données viennent de scripts/import-medicament-ma.mjs → medicaments-ma.json (une fiche par médicament).

export type MedicamentMa = {
  nom: string; // « BISOPROLOL 5 MG, Comprimé pelliculé »
  url: string; // fiche publique sur medicament.ma
  generique: boolean;
  presentation: string;
  dosage: string;
  labo: string;
  dci: string; // composition (substances actives)
  classe: string; // classe thérapeutique
  statut: string; // Commercialisé, etc.
  ppv: string; // prix public de vente
  tableau: string;
};

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Entree = { m: MedicamentMa; cle: string };
let index: Promise<Entree[]> | null = null;

function charger() {
  index ??= import("./medicaments-ma.json")
    .then((mod) =>
      (mod.default as MedicamentMa[]).map((m) => ({ m, cle: normaliser(`${m.nom} ${m.dci} ${m.labo}`) })),
    )
    .catch(() => []);
  return index;
}

// Recherche : tous les mots saisis doivent apparaître ; le nom commercial qui commence par la saisie passe en tête.
export async function chercherMedicaments(saisie: string, limite = 8): Promise<MedicamentMa[]> {
  const mots = normaliser(saisie).split(/[\s,]+/).filter(Boolean).slice(0, 6);
  if (!mots.length || normaliser(saisie).trim().length < 2) return [];
  const debut = normaliser(saisie).trim();
  const trouves: { m: MedicamentMa; rang: number }[] = [];
  for (const { m, cle } of await charger()) {
    if (!mots.every((mot) => cle.includes(mot))) continue;
    const nom = normaliser(m.nom);
    const rang = nom.startsWith(debut) ? 0 : nom.startsWith(mots[0]) ? 1 : m.dci && normaliser(m.dci).startsWith(mots[0]) ? 2 : 3;
    trouves.push({ m, rang: rang + (m.statut && !/commerc/i.test(m.statut) ? 0.5 : 0) });
  }
  return trouves
    .sort((a, b) => a.rang - b.rang)
    .slice(0, limite)
    .map((t) => t.m);
}

// Comptes rendus d'examens décrits par des données (ECG, MAPA, épreuve d'effort) : champs, calculs et propositions pour
// le « AU TOTAL », comme pour l'ETT (ett.ts). Aucun accès à la base ici : sert aussi dans le navigateur.

export type ChampExamen = {
  cle: string;
  libelle: string;
  type: "nombre" | "texte" | "choix";
  unite?: string;
  min?: number;
  max?: number;
  exemple?: string;
  options?: string[]; // pour un choix : texte retenu tel quel dans le compte rendu
};

export type SectionExamen = { titre: string; champs: ChampExamen[] };

// Âge et sexe du patient à la date de l'examen (pour la FMT, les seuils du QTc, de la PA d'effort…)
export type Contexte = { age: number | null; sexe: "" | "F" | "M" };

export type ValeursExamen = Record<string, string | number>;

export type Proposition = { texte: string; source: string };

export type ModeleExamen = {
  cle: string; // dans l'adresse : /patients/12/examen/ecg
  type: string; // type d'examen rangé dans le dossier (typesExamen)
  bouton: string;
  titre: string; // titre du compte rendu
  resume: string;
  sections: SectionExamen[];
  calculs: (v: ValeursExamen, c: Contexte) => string[];
  propositions: (v: ValeursExamen, c: Contexte) => Proposition[];
  // Origine des seuils, pour savoir ce qui a été vérifié
  verification: string;
};

// Données enregistrées avec l'examen (valeurs.cr)
export type DonneesExamen = {
  modele: string;
  indication: string;
  operateur: string;
  age: number | null;
  sexe: Contexte["sexe"];
  valeurs: ValeursExamen;
  total: string;
};

export const fr = (n: number, chiffres = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: chiffres });

export const nombre = (v: ValeursExamen, cle: string) => (typeof v[cle] === "number" ? (v[cle] as number) : null);
export const texte = (v: ValeursExamen, cle: string) => (typeof v[cle] === "string" ? (v[cle] as string) : "");

export const champs = (m: ModeleExamen) => m.sections.flatMap((s) => s.champs);

// Lignes du compte rendu : « Libellé : valeur unité », section par section, puis les calculs
export function lignesExamen(m: ModeleExamen, d: Pick<DonneesExamen, "valeurs" | "age" | "sexe">) {
  const sections = m.sections
    .map((s) => ({
      titre: s.titre,
      lignes: s.champs.flatMap((ch) => {
        const v = d.valeurs[ch.cle];
        if (v === undefined || v === "") return [];
        return [`${ch.libelle} : ${typeof v === "number" ? `${fr(v, 2)}${ch.unite ? ` ${ch.unite}` : ""}` : v}`];
      }),
    }))
    .filter((s) => s.lignes.length > 0);
  const calculs = m.calculs(d.valeurs, { age: d.age, sexe: d.sexe });
  return { sections, calculs };
}

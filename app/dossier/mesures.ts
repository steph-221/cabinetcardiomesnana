// Valeurs chiffrées d'une consultation et leurs bornes de vraisemblance.
// Sans accès à la base : sert aussi dans le navigateur (correction de la dictée).

// Valeurs saisies en consultation (biologie, échographie…), avec leurs bornes de vraisemblance
export const mesures = [
  { cle: "inr", libelle: "INR", unite: "", min: 0.5, max: 15 },
  { cle: "fevg", libelle: "FEVG", unite: "%", min: 5, max: 90 },
  { cle: "ldl", libelle: "LDL-c", unite: "g/L", min: 0.1, max: 6 },
  { cle: "creatinine", libelle: "Créatinine", unite: "mg/L", min: 1, max: 200 },
  { cle: "hba1c", libelle: "HbA1c", unite: "%", min: 3, max: 20 },
  { cle: "ntprobnp", libelle: "NT-proBNP", unite: "pg/mL", min: 1, max: 100000 },
] as const;

export type CleMesure = (typeof mesures)[number]["cle"];

export type Constantes = {
  taSys: number | null;
  taDia: number | null;
  fc: number | null;
  spo2: number | null;
  poids: number | null;
  taille: number | null;
};

// Bornes de vraisemblance des constantes (au-delà : faute de frappe probable)
export const bornesConstantes: Record<keyof Constantes, [number, number]> = {
  taSys: [50, 300],
  taDia: [20, 200],
  fc: [20, 250],
  spo2: [50, 100],
  poids: [1, 400],
  taille: [30, 250],
};

// Toutes les bornes, constantes et mesures confondues
export const bornes: Record<string, [number, number]> = {
  ...bornesConstantes,
  ...Object.fromEntries(mesures.map((m) => [m.cle, [m.min, m.max] as [number, number]])),
};

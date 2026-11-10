// Langue parlée par le patient en consultation (module commun au serveur et au navigateur, sans accès à la base)

export const languesPatient = [
  { valeur: "", libelle: "—" },
  { valeur: "fr", libelle: "Français" },
  { valeur: "ar", libelle: "Arabe" },
] as const;
export type LanguePatient = (typeof languesPatient)[number]["valeur"];
export const estLanguePatient = (v: string): v is LanguePatient => languesPatient.some((l) => l.valeur === v);

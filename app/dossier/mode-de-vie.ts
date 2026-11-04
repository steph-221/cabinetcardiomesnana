// Mode de vie du patient. Module sans accès base : utilisable dans les formulaires (navigateur).

export type StatutTabac = "" | "non" | "actuel" | "ancien";

export const statutsTabac: { valeur: StatutTabac; libelle: string }[] = [
  { valeur: "", libelle: "Non précisé" },
  { valeur: "non", libelle: "Non fumeur" },
  { valeur: "actuel", libelle: "Fumeur actuel" },
  { valeur: "ancien", libelle: "Ancien fumeur" },
];

export const libelleTabac = (statut: StatutTabac, paquetsAnnees: number | null) =>
  statut === ""
    ? ""
    : `${statutsTabac.find((s) => s.valeur === statut)!.libelle}${paquetsAnnees !== null ? ` (${paquetsAnnees} PA)` : ""}`;

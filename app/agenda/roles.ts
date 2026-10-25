// Rôles des comptes du personnel (utilisable aussi côté navigateur : aucune donnée secrète ici)

export const roles = ["medecin", "secretaire"] as const;
export type RoleCompte = (typeof roles)[number];
export const estRole = (valeur: string): valeur is RoleCompte => (roles as readonly string[]).includes(valeur);
export const nomsRoles: Record<RoleCompte | "admin", string> = {
  admin: "administrateur",
  medecin: "médecin",
  secretaire: "secrétaire",
};

// Noms des patients dans l'agenda : prénom et nom sont gardés séparément (propriétés de l'événement),
// pour pouvoir les reporter tels quels dans le dossier. Utilisable aussi côté navigateur.

export const nomComplet = (prenom: string | undefined, nom: string) => [prenom, nom].filter(Boolean).join(" ");

export const titreRendezvous = (prenom: string | undefined, nom: string, controle: boolean) =>
  `${controle ? "Contrôle" : "RDV"} — ${nomComplet(prenom, nom)}`;

// Anciens rendez-vous (avant la séparation prénom / nom) : seul le titre « RDV — Jean Dupont » existe
export const nomDepuisTitre = (titre: string) => titre.replace(/^(RDV|Contrôle) — /, "").trim();

// Ce que le patient a déjà indiqué, pour préremplir le dossier (ou la fiche papier)
export type Prefill = { nom: string; prenom: string; telephone: string; naissance: string; email: string };

export function paramsPrefill(r: {
  nom?: string;
  prenom?: string;
  telephone?: string;
  dateNaissance?: string;
  email?: string;
}) {
  const params = new URLSearchParams();
  for (const [cle, valeur] of [
    ["nom", r.nom],
    ["prenom", r.prenom],
    ["telephone", r.telephone],
    ["naissance", r.dateNaissance],
    ["email", r.email],
  ] as const) {
    if (valeur) params.set(cle, valeur);
  }
  return params;
}

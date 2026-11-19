import type { Resultat } from "../../agenda/notification";

// Réponse commune des actions de formulaire de l'espace cabinet

export type EtatFormulaire = { erreur: string; valeurs: Record<string, string> } | null;

// Modification d'un rendez-vous : erreur à corriger, ou confirmation avec ce qui a été envoyé au patient
export type EtatModification =
  | { erreur: string; valeurs: Record<string, string> }
  | { ok: true; notification: Resultat | null }
  | null;

// Renvoie les valeurs saisies pour que le formulaire ne se vide pas en cas d'erreur
export const echec = (erreur: string, formData: FormData): EtatFormulaire => ({
  erreur,
  valeurs: Object.fromEntries([...formData].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<
    string,
    string
  >,
});

export const texte = (formData: FormData, nom: string, longueur: number) =>
  String(formData.get(nom) ?? "").trim().slice(0, longueur);

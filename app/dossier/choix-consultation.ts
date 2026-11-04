// Choix de la consultation dans les formulaires (ordonnance, facture, examens). Sans accès base : testé à part.
// Valeur du champ « consultationId » : vide = automatique (consultation du même jour si elle est unique),
// « aucune » = aucun rattachement, sinon le numéro de la consultation choisie.

export type OptionConsultation = { id: number; date: string; motif: string };

export function lireChoixConsultation(brut: unknown): number | null | undefined {
  const texte = typeof brut === "string" ? brut.trim() : "";
  if (texte === "aucune") return null;
  // Numéro de consultation (le serveur vérifie ensuite qu'elle appartient bien à ce patient)
  if (/^[1-9]\d{0,8}$/.test(texte)) return Number(texte);
  return undefined;
}

// Consultation proposée d'emblée quand l'adresse en désigne une (?consultation=…) qui existe pour ce patient
export function consultationDemandee(brut: string | string[] | undefined, options: OptionConsultation[]) {
  const id = lireChoixConsultation(Array.isArray(brut) ? brut[0] : brut);
  return typeof id === "number" && options.some((c) => c.id === id) ? id : undefined;
}

export const libelleConsultation = (c: OptionConsultation) =>
  `${c.date.split("-").reverse().join("/")}${c.motif ? ` — ${c.motif}` : ""}`;

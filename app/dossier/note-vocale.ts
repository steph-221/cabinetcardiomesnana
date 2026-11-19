// Note vocale : le médecin dicte librement, le site propose des actions rangées (note au dossier, suivi à prévoir,
// traitement à ajouter ou à arrêter, ordonnance à préparer) qu'il valide une à une. Rien n'est enregistré avant.
// Aucun accès à la base ici : module commun au serveur et au navigateur, testable seul.

export type ActionNote =
  | { type: "note"; texte: string }
  | { type: "suivi"; quoi: string; echeance: string } // échéance « AAAA-MM-JJ », vide si elle reste à préciser
  | { type: "traitement"; medicament: string; posologie: string }
  | { type: "arret"; medicament: string }
  // Lignes dictées, une par médicament : ouvrent le formulaire d'ordonnance prérempli
  | { type: "ordonnance"; texte: string };

export const typesAction = ["note", "suivi", "traitement", "arret", "ordonnance"] as const;
export type TypeAction = (typeof typesAction)[number];

export const libellesAction: Record<TypeAction, string> = {
  note: "Note au dossier",
  suivi: "Suivi à prévoir",
  traitement: "Traitement à ajouter",
  arret: "Traitement à arrêter",
  ordonnance: "Ordonnance à préparer",
};

const jourValide = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime());

export function ajouterJoursA(jour: string, jours: number) {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

const court = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[ \t]+/g, " ").trim().slice(0, max) : "");

// Actions proposées par Claude (ou renvoyées par le navigateur après relecture) → actions sûres : types connus,
// textes bornés, échéance calculée à partir du délai dicté, jamais dans le passé.
export function normaliserActions(brut: unknown, aujourdhui: string): ActionNote[] {
  const liste = Array.isArray(brut) ? brut : [];
  const actions: ActionNote[] = [];
  for (const a of liste.slice(0, 20) as Record<string, unknown>[]) {
    if (!a || typeof a !== "object") continue;
    switch (a.type) {
      case "note": {
        const texte = court(a.texte, 2000);
        if (texte) actions.push({ type: "note", texte });
        break;
      }
      case "suivi": {
        const quoi = court(a.quoi, 200);
        if (!quoi) break;
        const delai = typeof a.delaiJours === "number" && a.delaiJours > 0 && a.delaiJours <= 3650 ? Math.round(a.delaiJours) : null;
        const date = jourValide(a.echeance) ? a.echeance : jourValide(a.date) ? a.date : delai ? ajouterJoursA(aujourdhui, delai) : "";
        actions.push({ type: "suivi", quoi, echeance: date && date >= aujourdhui ? date : "" });
        break;
      }
      case "traitement": {
        const medicament = court(a.medicament, 150);
        if (medicament) actions.push({ type: "traitement", medicament, posologie: court(a.posologie, 300) });
        break;
      }
      case "arret": {
        const medicament = court(a.medicament, 150);
        if (medicament) actions.push({ type: "arret", medicament });
        break;
      }
      case "ordonnance": {
        const texte = typeof a.texte === "string" ? a.texte.trim().slice(0, 2000) : "";
        if (texte) actions.push({ type: "ordonnance", texte });
        break;
      }
    }
  }
  return actions;
}

const sansAccents = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const premierMot = (t: string) => sansAccents(t).match(/\p{L}{3,}/u)?.[0] ?? "";

// Traitement en cours désigné par le nom dicté (« arrêter le Cardix ») : un seul doit correspondre, sinon rien
// n'est arrêté et le médecin choisit lui-même dans le dossier.
export function trouverTraitement<T extends { medicament: string; fin: string | null }>(traitements: T[], nom: string): T | null {
  const cherche = premierMot(nom);
  if (!cherche) return null;
  const trouves = traitements.filter((t) => !t.fin && sansAccents(t.medicament).includes(cherche));
  return trouves.length === 1 ? trouves[0] : null;
}

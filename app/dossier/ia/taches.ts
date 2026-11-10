// Un modèle et un niveau d'effort par tâche confiée à Claude, pour ne payer le modèle le plus fort que là où il
// sert. Les réglages ci-dessous sont les valeurs de départ ; l'administrateur peut les changer dans « Modèles IA »
// (table parametres), sans redéploiement. Aucun accès à la base ici : module testable seul.

// Du moins cher au plus fort. Tarifs en dollars par million de jetons (entrée / sortie), à tenir à jour d'après
// https://platform.claude.com/docs/en/about-claude/pricing
export const niveaux = ["haiku", "sonnet", "opus", "fable"] as const;
export type Niveau = (typeof niveaux)[number];

export const modeles: Record<
  Niveau,
  // repli : en cas de refus d'un filtre de sécurité, l'API relance elle-même la demande sur un autre modèle.
  // Haiku n'a pas ce repli : c'est alors l'escalade ci-dessous qui prend le relais.
  { id: string; nom: string; entree: number; sortie: number; repli: boolean }
> = {
  haiku: { id: "claude-haiku-5-5", nom: "Haiku", entree: 0.1, sortie: 0.5, repli: false },
  sonnet: { id: "claude-sonnet-5-5", nom: "Sonnet", entree: 2, sortie: 10, repli: true },
  opus: { id: "claude-opus-5-5", nom: "Opus", entree: 4, sortie: 20, repli: true },
  fable: { id: "claude-fable-5-2", nom: "Fable", entree: 8, sortie: 40, repli: true },
};

export const efforts = ["low", "medium", "high"] as const;
export type Effort = (typeof efforts)[number];
export const libellesEffort: Record<Effort, string> = { low: "faible", medium: "moyen", high: "élevé" };

export type Reglage = { niveau: Niveau; effort: Effort };

type Definition = Reglage & {
  libelle: string;
  // Ce qui déclenche une seconde tentative sur le modèle d'escalade
  controle: string;
  // Modèle utilisé quand le contrôle échoue, quand le modèle refuse ou n'accepte pas la demande (null : pas d'escalade)
  escalade: Niveau | null;
};

export const taches = {
  mots_cles: {
    libelle: "Mots-clés de recherche dans la bibliothèque",
    niveau: "haiku",
    effort: "low",
    controle: "aucun mot-clé, ou aucun passage trouvé",
    escalade: "sonnet",
  },
  dictee: {
    libelle: "Correction d'une dictée de consultation",
    niveau: "haiku",
    effort: "medium",
    controle: "valeur hors bornes ou plus de 8 mots douteux",
    escalade: "sonnet",
  },
  note_vocale: {
    libelle: "Note vocale : actions proposées",
    niveau: "haiku",
    effort: "medium",
    controle: "réponse illisible ou sans action",
    escalade: "sonnet",
  },
  ordonnance_dictee: {
    libelle: "Ordonnance dictée (quand le découpage automatique échoue)",
    niveau: "haiku",
    effort: "low",
    controle: "aucune ligne reconnue",
    escalade: "sonnet",
  },
  traduction_patient: {
    libelle: "Parole du patient en arabe : note en français",
    niveau: "sonnet",
    effort: "medium",
    controle: "réponse illisible ou vide",
    escalade: "opus",
  },
  reprise_word: {
    libelle: "Reprise d'un ancien compte rendu Word",
    niveau: "haiku",
    effort: "medium",
    controle: "visite sans date ou plus de 5 points à vérifier",
    escalade: "sonnet",
  },
  redaction: {
    libelle: "Rédaction d'un compte rendu d'examen",
    niveau: "sonnet",
    effort: "medium",
    controle: "texte vide ou référence citée absente de la bibliothèque",
    escalade: "opus",
  },
  assistant: {
    libelle: "Réponse de l'assistant avec citations",
    niveau: "opus",
    effort: "medium",
    controle: "—",
    escalade: null,
  },
  seuil: {
    libelle: "Vérification d'un seuil contre la bibliothèque",
    niveau: "opus",
    effort: "low",
    controle: "—",
    escalade: null,
  },
} as const satisfies Record<string, Definition>;

export type Tache = keyof typeof taches;
export const estTache = (t: string): t is Tache => Object.hasOwn(taches, t);

const rang = (n: Niveau) => niveaux.indexOf(n);

export const niveauSuperieur = (n: Niveau): Niveau | null => niveaux[rang(n) + 1] ?? null;

// Modèle de la seconde tentative : celui prévu pour la tâche, s'il est bien au-dessus du modèle qui vient d'échouer
export function cibleEscalade(tache: Tache, actuel: Niveau): Niveau | null {
  const cible: Niveau | null = taches[tache].escalade;
  return cible && rang(cible) > rang(actuel) ? cible : null;
}

// Réglage enregistré par l'administrateur (JSON), ou celui de départ si rien n'est enregistré ou lisible
export function lireReglageEnregistre(tache: Tache, brut: string | null): Reglage {
  const defaut: Reglage = { niveau: taches[tache].niveau, effort: taches[tache].effort };
  if (!brut) return defaut;
  try {
    const r = JSON.parse(brut) as { niveau?: unknown; effort?: unknown };
    return {
      niveau: (niveaux as readonly unknown[]).includes(r.niveau) ? (r.niveau as Niveau) : defaut.niveau,
      effort: (efforts as readonly unknown[]).includes(r.effort) ? (r.effort as Effort) : defaut.effort,
    };
  } catch {
    return defaut;
  }
}

export type Jetons = { entree: number; sortie: number; cacheLecture: number; cacheEcriture: number };

// Coût estimé d'un appel, en dollars : les lectures du cache coûtent un dixième du tarif d'entrée, les écritures
// un quart de plus. (Haiku passe à un tarif supérieur au-delà de 100 000 jetons d'entrée : jamais atteint ici.)
export function coutEstime(niveau: Niveau, j: Jetons) {
  const m = modeles[niveau];
  return (
    (j.entree * m.entree + j.cacheLecture * m.entree * 0.1 + j.cacheEcriture * m.entree * 1.25 + j.sortie * m.sortie) /
    1_000_000
  );
}

export const niveauDuModele = (id: string): Niveau | null => niveaux.find((n) => modeles[n].id === id) ?? null;

// Reconnaissance vocale : un seul point d'entrée pour tous les écrans, avec des moteurs remplaçables.
// Aujourd'hui : la reconnaissance du navigateur (Chrome, Edge, Safari), gratuite, qui transcrit pendant que l'on
// parle. Un autre moteur (reconnaissance faite sur l'ordinateur, service de transcription) s'ajoute dans `moteurs`
// sans toucher aux écrans. À n'importer que dans des composants « use client ».

export type LangueVoix = "fr" | "ar";

// Arabe : variante marocaine. Une seule langue par écoute : le mélange des deux dans une phrase est mal reconnu.
export const codesLangue: Record<LangueVoix, string> = { fr: "fr-FR", ar: "ar-MA" };

export type Ecoute = {
  langue: LangueVoix;
  // Morceau de texte définitif (une phrase ou un groupe de mots)
  surFinal: (texte: string) => void;
  // Texte en cours de reconnaissance, remplacé à chaque appel ; vide quand il est devenu définitif
  surProvisoire?: (texte: string) => void;
  // Fin de l'écoute : demandée, durée atteinte, ou erreur (avec son message)
  surFin: (erreur?: string) => void;
  // Durée maximale en secondes (sans limite par défaut)
  dureeMax?: number;
};

export type SessionVoix = { arreter: () => void };

export type MoteurVoix = {
  id: string;
  nom: string;
  disponible: () => boolean;
  ecouter: (e: Ecoute) => SessionVoix;
};

// --- Reconnaissance du navigateur (Web Speech API) ---

type ResultatNavigateur = { isFinal: boolean; 0: { transcript: string } };
type Reconnaissance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ResultatNavigateur> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type Fenetre = { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance };

const classeNavigateur = () =>
  typeof window === "undefined"
    ? undefined
    : ((window as unknown as Fenetre).SpeechRecognition ?? (window as unknown as Fenetre).webkitSpeechRecognition);

const messagesErreur: Record<string, string> = {
  "not-allowed": "Le micro n'est pas autorisé : autorisez-le dans le navigateur.",
  "service-not-allowed": "Le micro n'est pas autorisé : autorisez-le dans le navigateur.",
  "audio-capture": "Aucun micro n'a été trouvé sur cet appareil.",
  network: "La dictée du navigateur a besoin d'Internet. Vérifiez la connexion.",
  "language-not-supported": "Ce navigateur ne reconnaît pas cette langue.",
};

export const moteurNavigateur: MoteurVoix = {
  id: "navigateur",
  nom: "Reconnaissance du navigateur",
  disponible: () => Boolean(classeNavigateur()),
  ecouter(e) {
    const Classe = classeNavigateur();
    if (!Classe) {
      e.surFin("Ce navigateur ne sait pas dicter : utilisez Chrome, Edge ou Safari.");
      return { arreter: () => undefined };
    }
    const debut = Date.now();
    let actif = true;
    let erreur: string | undefined;
    let fini = false;
    const r = new Classe();
    r.lang = codesLangue[e.langue];
    r.continuous = true;
    r.interimResults = Boolean(e.surProvisoire);
    r.onresult = (evenement) => {
      let enCours = "";
      for (let i = evenement.resultIndex; i < evenement.results.length; i++) {
        const morceau = evenement.results[i][0].transcript;
        if (evenement.results[i].isFinal) {
          if (morceau.trim()) e.surFinal(morceau.trim());
        } else enCours += morceau;
      }
      e.surProvisoire?.(enCours.trim());
    };
    r.onerror = (evenement) => {
      // « no-speech », « aborted » : la reconnaissance redémarre d'elle-même (onend)
      const message = messagesErreur[evenement.error];
      if (!message) return;
      erreur = message;
      actif = false;
    };
    const terminer = () => {
      if (fini) return;
      fini = true;
      clearInterval(minuteur);
      e.surFin(erreur);
    };
    // Le navigateur s'arrête après un silence : on relance tant que l'écoute n'est pas terminée
    r.onend = () => {
      if (actif && (!e.dureeMax || Date.now() - debut < e.dureeMax * 1000)) {
        try {
          r.start();
          return;
        } catch {
          // Relance refusée par le navigateur : l'écoute se termine
        }
      }
      terminer();
    };
    const arreter = () => {
      actif = false;
      try {
        r.stop();
      } catch {
        terminer();
      }
    };
    const minuteur = setInterval(() => {
      if (e.dureeMax && Date.now() - debut >= e.dureeMax * 1000) arreter();
    }, 500);
    try {
      r.start();
    } catch {
      erreur = "La dictée n'a pas pu démarrer. Réessayez.";
      terminer();
    }
    return { arreter };
  },
};

// Moteurs disponibles, par ordre de préférence. Le premier qui fonctionne sur cet appareil est utilisé.
export const moteurs: MoteurVoix[] = [moteurNavigateur];

export const moteurActif = (): MoteurVoix | null => moteurs.find((m) => m.disponible()) ?? null;

// Une seule écoute à la fois dans la page : en démarrer une arrête celle qui est en cours et attend sa fin
// (le navigateur n'accepte pas deux reconnaissances en même temps).
let courante: SessionVoix | null = null;

export function ecouter(e: Ecoute): SessionVoix {
  const moteur = moteurActif();
  let arretee = false;
  let interne: SessionVoix | null = null;
  const publique: SessionVoix = {
    arreter: () => {
      arretee = true;
      interne?.arreter();
    },
  };
  const demarrer = () => {
    if (arretee) return e.surFin();
    if (!moteur) return e.surFin("Ce navigateur ne sait pas dicter : utilisez Chrome, Edge ou Safari.");
    courante = publique;
    interne = moteur.ecouter({
      ...e,
      surFin: (erreur) => {
        if (courante === publique) courante = null;
        e.surFin(erreur);
        const suivante = enAttente;
        enAttente = null;
        suivante?.();
      },
    });
  };
  if (courante) {
    // La précédente s'arrête ; celle-ci démarre à sa fin (la dernière demandée l'emporte)
    enAttente = demarrer;
    courante.arreter();
  } else demarrer();
  return publique;
}

let enAttente: (() => void) | null = null;

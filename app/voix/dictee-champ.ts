// Dictée dans n'importe quel champ de texte : le texte reconnu est corrigé (ponctuation dictée, lexique, sigles,
// médicaments) puis inséré à la position du curseur, morceau par morceau, pendant que l'on parle.
// Un seul état pour toute la page, partagé par le bouton micro, le raccourci clavier et les écrans qui ont leur
// propre bouton « Dicter ». À n'importer que dans des composants « use client ».

import { correctionsApportees, type Proposition } from "../dossier/apprentissage-lexique";
import { insererFragment } from "../dossier/correction-locale";
import { medicaments, sigles } from "../dossier/vocabulaire";
import { ecouter, type SessionVoix } from "./moteur";

export type Champ = HTMLInputElement | HTMLTextAreaElement;
type Lexique = { entendu: string; correct: string }[];

export type EtatDictee = {
  // Champ dans lequel on dicte, et son libellé pour l'affichage
  cible: Champ | null;
  libelle: string;
  provisoire: string;
  erreur: string;
  // Mots corrigés à la main après une dictée, proposés pour le lexique
  propositions: Proposition[];
};

let etat: EtatDictee = { cible: null, libelle: "", provisoire: "", erreur: "", propositions: [] };
const abonnes = new Set<() => void>();
let session: SessionVoix | null = null;
let lexique: Lexique = [];
// Texte de chaque champ tel que la dictée l'a laissé, pour repérer ensuite les mots corrigés à la main
const dictes = new Map<Champ, string>();

const publier = (changement: Partial<EtatDictee>) => {
  etat = { ...etat, ...changement };
  for (const a of abonnes) a();
};

export const abonner = (rappel: () => void) => {
  abonnes.add(rappel);
  return () => void abonnes.delete(rappel);
};
export const lireEtat = () => etat;
const etatServeur: EtatDictee = { cible: null, libelle: "", provisoire: "", erreur: "", propositions: [] };
export const lireEtatServeur = () => etatServeur;

export const reglerLexique = (entrees: Lexique) => {
  lexique = [...entrees];
};
export const lexiqueCourant = () => lexique;
export const apprendreMot = (entendu: string, correct: string) => {
  lexique = [...lexique.filter((l) => l.entendu.toLowerCase() !== entendu.toLowerCase()), { entendu, correct }];
};

// Champs où l'on peut dicter : toute zone de texte, et les champs d'une ligne prévus pour une phrase
// (200 caractères ou plus). `data-dictee="oui"` ou `"non"` force le choix.
export function estDictable(el: Element | null): el is Champ {
  if (!el || (el as HTMLElement).closest?.('[data-dictee="non"]')) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (!(el instanceof HTMLInputElement) || el.readOnly || el.disabled) return false;
  if (!["text", "search"].includes(el.type) || ["numeric", "decimal", "tel", "email"].includes(el.inputMode)) return false;
  return el.dataset.dictee === "oui" || el.maxLength >= 200;
}

export function libelleDe(el: Champ) {
  const brut =
    el.getAttribute("aria-label") ||
    el.labels?.[0]?.childNodes[0]?.textContent ||
    el.labels?.[0]?.textContent ||
    el.placeholder ||
    el.name;
  return (brut ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

// Écrit dans le champ comme le ferait une frappe au clavier, pour que les formulaires React suivent
function ecrire(el: Champ, valeur: string, curseur: number) {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(el, valeur);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  try {
    el.setSelectionRange(curseur, curseur);
  } catch {
    // Champ sans sélection : le texte est écrit, le curseur reste où il est
  }
}

function inserer(el: Champ, morceau: string) {
  const debut = el.selectionStart ?? el.value.length;
  const fin = el.selectionEnd ?? debut;
  const r = insererFragment(el.value.slice(0, debut), el.value.slice(fin), morceau, lexique);
  if (!r.insere) return true;
  if (el.maxLength > 0 && r.valeur.length > el.maxLength) return false;
  ecrire(el, r.valeur, r.curseur);
  dictes.set(el, r.valeur);
  return true;
}

export function arreterDictee() {
  session?.arreter();
}

// Démarre la dictée dans ce champ, ou l'arrête si elle y est déjà en cours
export function dicterDans(el: Champ) {
  if (etat.cible === el) return arreterDictee();
  publier({ cible: el, libelle: libelleDe(el), provisoire: "", erreur: "" });
  const maSession = ecouter({
    langue: "fr",
    dureeMax: 15 * 60,
    surProvisoire: (provisoire) => {
      if (etat.cible === el) publier({ provisoire });
    },
    surFinal: (morceau) => {
      if (!el.isConnected) return arreterDictee();
      if (!inserer(el, morceau)) {
        publier({ erreur: "Ce champ est plein : la dictée s'arrête." });
        arreterDictee();
      }
    },
    surFin: (erreur) => {
      if (session === maSession) session = null;
      if (etat.cible === el) publier({ cible: null, provisoire: "", erreur: erreur ?? etat.erreur });
    },
  });
  session = maSession;
}

export const effacerErreur = () => publier({ erreur: "" });

// Noms que le lexique ne doit pas remplacer : un médicament pris pour un autre serait une erreur grave
const proteges = new Set(
  [...medicaments, ...sigles.map(([s]) => s)].map((m) => m.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()),
);

// À l'envoi d'un formulaire : les mots que le médecin a corrigés à la main depuis la dictée sont proposés au lexique
export function releverCorrections(formulaire: HTMLFormElement) {
  const nouvelles: Proposition[] = [];
  for (const [el, texteDicte] of dictes) {
    if (!el.isConnected) dictes.delete(el);
    else if (formulaire.contains(el)) {
      nouvelles.push(...correctionsApportees(texteDicte, el.value, 5, proteges));
      dictes.delete(el);
    }
  }
  const connues = new Set([...lexique.map((l) => l.entendu.toLowerCase()), ...etat.propositions.map((p) => p.entendu.toLowerCase())]);
  const ajout = nouvelles.filter((p, i) => !connues.has(p.entendu.toLowerCase()) && nouvelles.findIndex((q) => q.entendu === p.entendu) === i);
  if (ajout.length) publier({ propositions: [...etat.propositions, ...ajout].slice(0, 6) });
}

export const retirerProposition = (entendu: string) =>
  publier({ propositions: etat.propositions.filter((p) => p.entendu !== entendu) });

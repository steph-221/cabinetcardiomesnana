// Note vocale et ordonnance dictée : mise en actions par Claude. Le texte reçu ici est déjà masqué (nom du patient,
// date de naissance, téléphones). Claude ne fait que proposer : le médecin valide chaque action. Clé : ANTHROPIC_API_KEY.

import { appelerIA } from "./ia/appel";
import { normaliserActions, type ActionNote } from "./note-vocale";
import type { LigneDictee } from "./ordonnance-dictee";
import { suivisCourants } from "./suivis";
import { glossaire } from "./vocabulaire";

const texteOuVide = { type: "string" };
const schemaActions = {
  type: "object",
  additionalProperties: false,
  required: ["actions"],
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "texte", "quoi", "delaiJours", "date", "medicament", "posologie"],
        properties: {
          type: { type: "string", enum: ["note", "suivi", "traitement", "arret", "ordonnance"] },
          texte: texteOuVide,
          quoi: texteOuVide,
          delaiJours: { anyOf: [{ type: "integer" }, { type: "null" }] },
          date: { anyOf: [{ type: "string" }, { type: "null" }] },
          medicament: texteOuVide,
          posologie: texteOuVide,
        },
      },
    },
  },
};

const CONSIGNES_ACTIONS = `Tu ranges la note dictée par un cardiologue (reconnaissance vocale du navigateur, souvent sans ponctuation) en actions à valider dans le dossier d'un patient. Le nom du patient est remplacé par [PATIENT].

Types d'action (les champs qui ne servent pas restent "" ou null) :
- "note" : information à garder au dossier. Champ texte : la phrase mise au propre.
- "suivi" : examen ou consultation à prévoir. Champ quoi : libellé court, de préférence l'un de : ${suivisCourants.join(" ; ")}. Échéance : delaiJours quand un délai est dicté (« dans 6 mois » → 182, « dans 3 mois » → 91, « dans un mois » → 30, « dans une semaine » → 7, « dans un an » → 365), ou date au format AAAA-MM-JJ quand une date précise est dictée. Sans échéance dictée : les deux à null.
- "traitement" : médicament à ajouter au traitement de fond du dossier (« débuter », « mettre sous », « ajouter »). Champs medicament (nom et dosage) et posologie.
- "arret" : traitement à arrêter. Champ medicament : le nom dicté.
- "ordonnance" : prescription à imprimer (« ordonnance », « prescrire », « renouveler »). Champ texte : une ligne par médicament, « nom dosage, posologie, durée », telles que dictées.

Règles :
1. N'ajoute JAMAIS ce qui n'a pas été dicté : aucun médicament, aucune dose, aucune durée, aucun examen, aucune échéance. Ne complète pas une posologie incomplète.
2. Une action par élément dicté. Un médicament à la fois débuté et prescrit donne une action "traitement" et une ligne dans "ordonnance".
3. Corrige seulement les erreurs de reconnaissance (sigles, noms de médicaments) à l'aide du glossaire. Écris les nombres en chiffres.
4. Ce qui ne correspond à aucun autre type devient une "note". Une consigne pour le secrétariat (« demander de rappeler… ») devient une "note" qui commence par « Secrétariat : ».
5. Si rien n'est exploitable, renvoie une seule action "note" avec le texte dicté.

Glossaire :
${glossaire}`;

// Texte masqué → actions proposées. `aujourdhui` : « AAAA-MM-JJ », pour calculer les échéances.
export async function proposerActions(texteMasque: string, aujourdhui: string, superieur = false): Promise<ActionNote[]> {
  const lire = (t: string) => normaliserActions((JSON.parse(t) as { actions?: unknown }).actions, aujourdhui);
  const reponse = await appelerIA({
    tache: "note_vocale",
    consignes: CONSIGNES_ACTIONS,
    contenu: `Date du jour : ${aujourdhui}\n\nNote dictée :\n${texteMasque}`,
    schema: schemaActions,
    maxTokens: 4000,
    controle: (t) => lire(t).length > 0,
    superieur,
  });
  if (reponse.arret === "refusal") throw new Error("La mise en actions a été refusée");
  if (reponse.arret === "max_tokens") throw new Error("Note trop longue");
  return lire(reponse.texte);
}

const schemaLignes = {
  type: "object",
  additionalProperties: false,
  required: ["lignes"],
  properties: {
    lignes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["medicament", "posologie", "duree"],
        properties: { medicament: texteOuVide, posologie: texteOuVide, duree: texteOuVide },
      },
    },
  },
};

const CONSIGNES_ORDONNANCE = `Tu découpes l'ordonnance dictée par un cardiologue (reconnaissance vocale du navigateur, souvent sans ponctuation) en lignes : medicament (nom et dosage), posologie, duree.

Règles :
1. N'ajoute JAMAIS ce qui n'a pas été dicté : ni médicament, ni dosage, ni posologie, ni durée. Un champ non dicté reste "".
2. Une ligne par médicament, dans l'ordre de la dictée.
3. Corrige seulement les erreurs de reconnaissance des noms de médicaments à l'aide du glossaire. Écris les nombres en chiffres (« un comprimé » → « 1 comprimé », « trois mois » → « 3 mois »).
4. Une fréquence (« tous les 2 jours », « 5 jours sur 7 ») appartient à la posologie, pas à la durée.

Glossaire :
${glossaire}`;

export async function decouperOrdonnanceIA(dictee: string): Promise<LigneDictee[]> {
  const lire = (t: string) => {
    const lignes = (JSON.parse(t) as { lignes?: Record<string, unknown>[] }).lignes ?? [];
    return lignes
      .slice(0, 30)
      .map((l) => ({
        medicament: String(l.medicament ?? "").trim().slice(0, 150),
        posologie: String(l.posologie ?? "").trim().slice(0, 300),
        duree: String(l.duree ?? "").trim().slice(0, 50),
      }))
      .filter((l) => l.medicament)
      .map((l) => ({ ...l, douteux: !l.posologie }));
  };
  const reponse = await appelerIA({
    tache: "ordonnance_dictee",
    consignes: CONSIGNES_ORDONNANCE,
    contenu: `Ordonnance dictée :\n${dictee}`,
    schema: schemaLignes,
    maxTokens: 4000,
    controle: (t) => lire(t).length > 0,
  });
  if (reponse.arret === "refusal" || reponse.arret === "max_tokens") throw new Error("Découpage impossible");
  return lire(reponse.texte);
}

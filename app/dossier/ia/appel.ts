// Passage unique de tous les appels à Claude : le modèle et l'effort viennent du réglage de la tâche (taches.ts),
// les consignes fixes sont mises en cache par l'API, chaque appel est inscrit au journal des jetons, et une réponse
// qui ne passe pas son contrôle est redemandée une fois au modèle d'escalade de la tâche. Clé : ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  cibleEscalade,
  coutEstime,
  modeles,
  niveauDuModele,
  niveauSuperieur,
  type Effort,
  type Niveau,
  type Reglage,
  type Tache,
} from "./taches";
import { lireReglage, noterAppel, type Appel, type Issue } from "./usage";

export type Demande = {
  tache: Tache;
  // Consignes fixes de la tâche : identiques d'un appel à l'autre, donc mises en cache
  consignes: string;
  contenu: string | BetaContentBlockParam[];
  // Schéma JSON de la réponse (incompatible avec les citations : l'assistant n'en donne pas)
  schema?: Record<string, unknown>;
  maxTokens: number;
  // Faux quand la réponse n'est pas utilisable : elle est alors redemandée au modèle d'escalade
  controle?: (texte: string) => boolean;
  // « Refaire avec le modèle supérieur » : part du modèle juste au-dessus de celui du réglage
  superieur?: boolean;
  par?: string;
};

export type Resultat = {
  contenu: BetaContentBlock[];
  texte: string;
  arret: BetaMessage["stop_reason"];
  niveau: Niveau;
  escalade: boolean;
};

// Corps de la demande pour un modèle donné
export function parametres(d: Demande, niveau: Niveau, effort: Effort): MessageCreateParamsNonStreaming {
  const m = modeles[niveau];
  return {
    model: m.id,
    max_tokens: d.maxTokens,
    // Si un filtre de sécurité refuse la demande à tort, l'API la relance sur le modèle de repli recommandé
    ...(m.repli ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    output_config: { effort, ...(d.schema ? { format: { type: "json_schema" as const, schema: d.schema } } : {}) },
    system: [{ type: "text", text: d.consignes, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: d.contenu }],
  };
}

type Dependances = {
  envoyer: (p: MessageCreateParamsNonStreaming) => Promise<BetaMessage>;
  reglage: (tache: Tache) => Promise<Reglage>;
  noter: (a: Appel) => Promise<void>;
};

// Demande refusée par l'API pour ce modèle précis (paramètre non accepté, modèle indisponible pour le compte…) :
// un autre modèle peut l'accepter. Les pannes passagères (429, 5xx) sont déjà réessayées par le SDK.
const refuseParLeModele = (erreur: unknown) =>
  erreur instanceof Anthropic.APIError && [400, 403, 404].includes(erreur.status ?? 0);

export function creerAppel({ envoyer, reglage, noter }: Dependances) {
  async function tenter(d: Demande, niveau: Niveau, effort: Effort, escalade: boolean) {
    const debut = Date.now();
    const journal = (r: BetaMessage | null, issue: Issue) => {
      const servi = (r && niveauDuModele(r.model)) ?? niveau;
      const jetons = {
        entree: r?.usage.input_tokens ?? 0,
        sortie: r?.usage.output_tokens ?? 0,
        cacheLecture: r?.usage.cache_read_input_tokens ?? 0,
        cacheEcriture: r?.usage.cache_creation_input_tokens ?? 0,
      };
      return noter({
        ...jetons,
        tache: d.tache,
        modele: r?.model ?? modeles[niveau].id,
        niveau: servi,
        effort,
        cout: coutEstime(servi, jetons),
        dureeMs: Date.now() - debut,
        escalade,
        issue,
        par: d.par ?? "",
      });
    };

    let reponse: BetaMessage;
    try {
      reponse = await envoyer(parametres(d, niveau, effort));
    } catch (erreur) {
      await journal(null, "erreur");
      throw erreur;
    }
    const texte = reponse.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let valide = true;
    try {
      valide = !d.controle || d.controle(texte);
    } catch {
      valide = false;
    }
    const issue: Issue =
      reponse.stop_reason === "refusal"
        ? "refus"
        : reponse.stop_reason === "max_tokens"
          ? "tronque"
          : valide
            ? "ok"
            : "controle";
    await journal(reponse, issue);
    return { resultat: { contenu: reponse.content, texte, arret: reponse.stop_reason, niveau, escalade }, issue };
  }

  return async function appeler(d: Demande): Promise<Resultat> {
    const r = await reglage(d.tache);
    const niveau = d.superieur ? (niveauSuperieur(r.niveau) ?? r.niveau) : r.niveau;
    const cible = cibleEscalade(d.tache, niveau);
    let premier: Awaited<ReturnType<typeof tenter>>;
    try {
      premier = await tenter(d, niveau, r.effort, false);
    } catch (erreur) {
      if (!cible || !refuseParLeModele(erreur)) throw erreur;
      return (await tenter(d, cible, r.effort, true)).resultat;
    }
    // Une réponse tronquée ne s'arrange pas en changeant de modèle : l'appelant la signale
    if (!cible || premier.issue === "ok" || premier.issue === "tronque") return premier.resultat;
    return (await tenter(d, cible, r.effort, true)).resultat;
  };
}

let client: Anthropic | null = null;

export const appelerIA = creerAppel({
  envoyer: (p) => (client ??= new Anthropic()).beta.messages.create(p),
  reglage: lireReglage,
  noter: noterAppel,
});

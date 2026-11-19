import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { describe, expect, it } from "vitest";
import { creerAppel, parametres, type Demande } from "./appel";
import { cibleEscalade, coutEstime, lireReglageEnregistre, modeles, niveauSuperieur, taches, type Tache } from "./taches";
import type { Appel } from "./usage";

const reponse = (model: string, texte: string, stop: BetaMessage["stop_reason"] = "end_turn") =>
  ({
    model,
    stop_reason: stop,
    content: [{ type: "text", text: texte, citations: null }],
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  }) as unknown as BetaMessage;

// Client simulé : répond d'après le modèle demandé et retient les demandes reçues
function banc(repondre: (modele: string) => BetaMessage | Error, enregistres: Partial<Record<Tache, string>> = {}) {
  const demandes: string[] = [];
  const journal: Appel[] = [];
  const appeler = creerAppel({
    envoyer: async (p) => {
      demandes.push(p.model);
      const r = repondre(p.model);
      if (r instanceof Error) throw r;
      return r;
    },
    reglage: async (t) => lireReglageEnregistre(t, enregistres[t] ?? null),
    noter: async (a) => void journal.push(a),
  });
  return { appeler, demandes, journal };
}

const demande = (d: Partial<Demande> = {}): Demande => ({
  tache: "dictee",
  consignes: "Consignes",
  contenu: "Texte",
  maxTokens: 1000,
  ...d,
});

describe("réglages par tâche", () => {
  it("donne à chaque tâche un modèle connu et une escalade vers un modèle supérieur", () => {
    for (const [nom, t] of Object.entries(taches)) {
      expect(modeles[t.niveau], nom).toBeDefined();
      if (t.escalade) expect(cibleEscalade(nom as Tache, t.niveau), nom).toBe(t.escalade);
    }
  });
  it("garde les tâches simples sur le modèle le moins cher et l'assistant sur Opus", () => {
    expect(taches.mots_cles.niveau).toBe("haiku");
    expect(taches.dictee.niveau).toBe("haiku");
    expect(taches.assistant.niveau).toBe("opus");
  });
  it("lit un réglage enregistré et ignore ce qui est illisible", () => {
    expect(lireReglageEnregistre("dictee", '{"niveau":"opus","effort":"low"}')).toEqual({ niveau: "opus", effort: "low" });
    expect(lireReglageEnregistre("dictee", '{"niveau":"gpt","effort":"max"}')).toEqual({ niveau: "haiku", effort: "medium" });
    expect(lireReglageEnregistre("dictee", "pas du json")).toEqual({ niveau: "haiku", effort: "medium" });
  });
  it("n'escalade pas vers un modèle égal ou inférieur", () => {
    expect(cibleEscalade("dictee", "sonnet")).toBeNull();
    expect(cibleEscalade("dictee", "opus")).toBeNull();
    expect(niveauSuperieur("fable")).toBeNull();
  });
  it("estime le coût : Haiku quarante fois moins cher qu'Opus", () => {
    const jetons = { entree: 1_000_000, sortie: 1_000_000, cacheLecture: 0, cacheEcriture: 0 };
    expect(coutEstime("opus", jetons)).toBeCloseTo(24);
    expect(coutEstime("haiku", jetons)).toBeCloseTo(0.6);
    expect(coutEstime("opus", { entree: 0, sortie: 0, cacheLecture: 1_000_000, cacheEcriture: 0 })).toBeCloseTo(0.4);
  });
});

describe("corps de la demande", () => {
  it("fixe l'effort, met les consignes en cache et ne demande le repli que là où il existe", () => {
    const haiku = parametres(demande({ schema: { type: "object" } }), "haiku", "medium");
    expect(haiku.model).toBe("claude-haiku-5-5");
    expect(haiku.output_config).toEqual({ effort: "medium", format: { type: "json_schema", schema: { type: "object" } } });
    expect(haiku.fallbacks).toBeUndefined();
    expect(haiku.betas).toBeUndefined();
    expect(haiku.system).toEqual([{ type: "text", text: "Consignes", cache_control: { type: "ephemeral" } }]);

    const opus = parametres(demande(), "opus", "low");
    expect(opus.fallbacks).toBe("default");
    expect(opus.output_config).toEqual({ effort: "low" });
  });
});

describe("appel et escalade", () => {
  it("s'arrête au premier modèle quand la réponse passe le contrôle", async () => {
    const b = banc((m) => reponse(m, "bon"));
    const r = await b.appeler(demande({ controle: (t) => t === "bon" }));
    expect(b.demandes).toEqual(["claude-haiku-5-5"]);
    expect(r).toMatchObject({ texte: "bon", niveau: "haiku", escalade: false });
    expect(b.journal).toHaveLength(1);
    expect(b.journal[0]).toMatchObject({ tache: "dictee", niveau: "haiku", issue: "ok", entree: 1000, sortie: 200 });
    expect(b.journal[0].cout).toBeCloseTo(0.0002);
  });

  it("redemande au modèle d'escalade quand le contrôle échoue, ou lève une erreur", async () => {
    const b = banc((m) => reponse(m, m.includes("haiku") ? "mauvais" : "bon"));
    const r = await b.appeler(
      demande({
        controle: (t) => {
          if (t === "mauvais") throw new Error("illisible");
          return true;
        },
      }),
    );
    expect(b.demandes).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
    expect(r).toMatchObject({ texte: "bon", niveau: "sonnet", escalade: true });
    expect(b.journal.map((j) => j.issue)).toEqual(["controle", "ok"]);
    expect(b.journal[1].escalade).toBe(true);
  });

  it("escalade après un refus de Haiku, qui n'a pas de repli côté API", async () => {
    const b = banc((m) => reponse(m, "", m.includes("haiku") ? "refusal" : "end_turn"));
    await b.appeler(demande());
    expect(b.demandes).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
    expect(b.journal[0].issue).toBe("refus");
  });

  it("escalade quand l'API n'accepte pas la demande pour ce modèle, mais pas sur une panne", async () => {
    const refus = new Anthropic.APIError(400, undefined, "paramètre non accepté", undefined);
    const b = banc((m) => (m.includes("haiku") ? refus : reponse(m, "bon")));
    expect((await b.appeler(demande())).niveau).toBe("sonnet");
    expect(b.journal.map((j) => j.issue)).toEqual(["erreur", "ok"]);

    const panne = banc(() => new Error("réseau coupé"));
    await expect(panne.appeler(demande())).rejects.toThrow("réseau coupé");
    expect(panne.demandes).toHaveLength(1);
  });

  it("ne change pas de modèle pour une réponse tronquée", async () => {
    const b = banc((m) => reponse(m, "{", "max_tokens"));
    const r = await b.appeler(demande({ controle: () => false }));
    expect(b.demandes).toHaveLength(1);
    expect(r.arret).toBe("max_tokens");
  });

  it("rend la réponse telle quelle quand la tâche n'a pas d'escalade", async () => {
    const b = banc((m) => reponse(m, "", "refusal"));
    const r = await b.appeler(demande({ tache: "assistant" }));
    expect(b.demandes).toEqual(["claude-opus-5-5"]);
    expect(r.arret).toBe("refusal");
  });

  it("suit le réglage de l'administrateur et le bouton « modèle supérieur »", async () => {
    const regle = banc((m) => reponse(m, "bon"), { dictee: '{"niveau":"opus","effort":"low"}' });
    await regle.appeler(demande());
    expect(regle.demandes).toEqual(["claude-opus-5-5"]);
    expect(regle.journal[0].effort).toBe("low");

    const superieur = banc((m) => reponse(m, "bon"));
    await superieur.appeler(demande({ superieur: true }));
    expect(superieur.demandes).toEqual(["claude-sonnet-5-5"]);
  });

  it("compte le coût sur le modèle qui a réellement répondu après un repli de l'API", async () => {
    const b = banc(() => reponse("claude-sonnet-5-5", "bon"));
    await b.appeler(demande({ tache: "assistant" }));
    expect(b.journal[0]).toMatchObject({ modele: "claude-sonnet-5-5", niveau: "sonnet" });
  });
});

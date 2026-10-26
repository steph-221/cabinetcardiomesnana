// Amélioration facultative de la dictée par Claude (Anthropic) : correction des termes et rangement par rubrique,
// avec le vocabulaire de cardiologie et le lexique du cabinet. La reconnaissance vocale se fait dans le navigateur,
// et une première correction gratuite y est déjà appliquée (correction-locale.ts). Clé : ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { rubriques, type Correction } from "./correction-locale";
import { bornes, bornesConstantes, mesures, type Constantes } from "./mesures";
import { glossaire } from "./vocabulaire";

export const claudeConfigure = () => Boolean(process.env.ANTHROPIC_API_KEY);

const champsChiffres = [...(Object.keys(bornesConstantes) as (keyof Constantes)[]), ...mesures.map((m) => m.cle)];

const nombreOuRien = { anyOf: [{ type: "number" }, { type: "null" }] };
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["rubriques", "valeurs", "incertains"],
  properties: {
    rubriques: {
      type: "object",
      additionalProperties: false,
      required: [...rubriques],
      properties: Object.fromEntries(rubriques.map((r) => [r, { type: "string" }])),
    },
    valeurs: {
      type: "object",
      additionalProperties: false,
      required: champsChiffres,
      properties: Object.fromEntries(champsChiffres.map((c) => [c, nombreOuRien])),
    },
    incertains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entendu", "propose"],
        properties: { entendu: { type: "string" }, propose: { type: "string" } },
      },
    },
  },
};

// Consignes fixes (mises en cache par l'API) ; le lexique du cabinet et la dictée viennent ensuite
const CONSIGNES = `Tu mets au propre la dictée d'un cardiologue, transcrite automatiquement par la reconnaissance vocale du navigateur (souvent sans ponctuation), pour remplir un rapport de consultation de cardiologie en français.

Règles :
1. Corrige les erreurs de reconnaissance (mots déformés, homophones, sigles mal compris) à l'aide du glossaire et du lexique du cabinet. Exemples : « bi soprolol » → « bisoprolol », « ache vé gé » → « HVG », « sin trom » → « Sintrom ».
2. N'ajoute JAMAIS d'information qui n'a pas été dictée : aucun diagnostic, examen, traitement, posologie ni valeur. Ne complète pas, ne résume pas, ne reformule pas le sens. Si tu hésites sur un mot, garde la forme la plus probable et signale-le dans « incertains » (entendu = ce que dit la transcription, propose = ta correction).
3. Commandes dictées : « à la ligne » ou « nouvelle ligne » = retour à la ligne ; « point », « virgule », « deux points » = ponctuation ; « motif », « examen », « ECG » ou « électrocardiogramme », « autres », « conclusion », « conduite à tenir » prononcés en début de phrase (éventuellement précédés de « rubrique ») = changement de rubrique. Ne recopie pas les commandes elles-mêmes.
4. Rubriques : motif (motif de consultation), examen (examen clinique), ecg (électrocardiogramme), autres (biologie, échographie et autres résultats), conclusion, conduite (conduite à tenir, traitement, prochain rendez-vous). Sans rubrique annoncée, range chaque phrase dans la rubrique qui correspond à son contenu. Une rubrique non dictée reste vide.
5. Valeurs chiffrées : quand une valeur est dictée, recopie-la aussi dans « valeurs », en chiffres. Unités attendues : taSys et taDia en mmHg (« 13/8 » ou « treize huit » signifie 130/80 mmHg), fc en bpm, spo2 en %, poids en kg, taille en cm, inr sans unité, fevg en %, ldl en g/L, creatinine en mg/L, hba1c en %, ntprobnp en pg/mL. Si l'unité dictée est différente (mmol/L, µmol/L…), ne convertis pas : laisse la valeur à null et garde-la dans le texte. Une valeur non dictée est null.
6. Écris les sigles comme dans le glossaire (FEVG, HVG, ETT, AVK…), les nombres en chiffres (« cinquante-cinq pour cent » → « 55 % ») et les médicaments avec leur orthographe correcte. Style de compte rendu : phrases courtes, sans formule de politesse.

Glossaire :
${glossaire}`;

let client: Anthropic | null = null;

export async function corriger(transcription: string, lexique: { entendu: string; correct: string }[]) {
  client ??= new Anthropic();
  const reponse = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    // Si un filtre de sécurité refuse la demande à tort, l'API la relance sur le modèle de repli recommandé
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: [{ type: "text", text: CONSIGNES, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          lexique.length
            ? `Lexique du cabinet (forme entendue → forme correcte) :\n${lexique.map((l) => `- ${l.entendu} → ${l.correct}`).join("\n")}`
            : "Lexique du cabinet : vide.",
          `Transcription de la dictée :\n${transcription}`,
        ].join("\n\n"),
      },
    ],
  });
  if (reponse.stop_reason === "refusal") throw new Error("La correction automatique a été refusée");
  if (reponse.stop_reason === "max_tokens") throw new Error("Dictée trop longue pour la correction automatique");
  const texte = reponse.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return verifier(JSON.parse(texte) as Correction);
}

// Ne garde que des valeurs vraisemblables : une valeur hors bornes est retirée (elle reste dans le texte)
function verifier(c: Correction): Correction {
  const valeurs: Correction["valeurs"] = {};
  for (const [cle, v] of Object.entries(c.valeurs ?? {})) {
    const [min, max] = bornes[cle] ?? [0, -1];
    if (typeof v === "number" && v >= min && v <= max) valeurs[cle] = v;
  }
  return {
    rubriques: Object.fromEntries(
      rubriques.map((r) => [r, String(c.rubriques?.[r] ?? "").trim()]),
    ) as Correction["rubriques"],
    valeurs,
    incertains: (c.incertains ?? []).filter((i) => i.entendu && i.propose && i.entendu !== i.propose).slice(0, 20),
  };
}

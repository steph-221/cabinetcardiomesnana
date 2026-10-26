// Assistant de cardiologie à références : il ne répond qu'à partir des passages de la bibliothèque du cabinet,
// et chaque phrase de sa réponse est rattachée au passage cité (citations de l'API Claude). Sans passage
// pertinent, il répond « Pas de réponse dans la bibliothèque » plutôt que de deviner. Clé : ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlock, BetaTextBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { libelleSource, rechercherPassages, typesSource, type Passage } from "./bibliotheque";

export const SANS_REPONSE = "Pas de réponse dans la bibliothèque.";

export type Bloc = { texte: string; citations: { passage: number; cite: string }[] };

export type Reponse = {
  blocs: Bloc[];
  // Passages transmis à l'assistant (les citations renvoient à leur position dans cette liste)
  passages: {
    id: number;
    page: number | null;
    texte: string;
    source: { id: number; libelle: string; type: string; url: string };
  }[];
  termes: { en: string[]; fr: string[] };
  contexte: string | null;
  sansReponse: boolean;
};

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const schemaTermes = {
  type: "object",
  additionalProperties: false,
  required: ["en", "fr"],
  properties: {
    en: { type: "array", items: { type: "string" } },
    fr: { type: "array", items: { type: "string" } },
  },
};

const CONSIGNES_TERMES = `Tu prépares une recherche plein texte dans la bibliothèque d'un cabinet de cardiologie au Maroc : recommandations de l'ESC (en anglais), RCP de médicaments, protocoles et fiches (en français).

À partir de la question du cardiologue, donne les mots-clés à chercher :
- « en » : en anglais, avec le vocabulaire des recommandations ESC ;
- « fr » : en français.

Pour chaque langue, 5 à 15 termes courts (un à trois mots), sans phrase. Inclure :
- la DCI des noms commerciaux, notamment marocains (Cardix → carvedilol / carvédilol, Sintrom → acenocoumarol / acénocoumarol) ;
- les sigles et leur forme développée (FA, AF, atrial fibrillation ; IC, HF, heart failure ; DFG, eGFR, creatinine clearance) ;
- les synonymes et la classe thérapeutique quand elle aide (anticoagulant, NOAC, DOAC, AOD) ;
- les notions précises de la question (dose, dose reduction, contraindication, target INR, mechanical valve…).`;

const CONSIGNES_REPONSE = `Tu es l'assistant de cardiologie d'un cabinet au Maroc. Tu réponds en français à la question d'un cardiologue, UNIQUEMENT à partir des documents fournis : ce sont des extraits de la bibliothèque du cabinet (recommandations de l'ESC, RCP de médicaments, protocoles, fiches validées par le médecin), avec leur titre, leur année et leur page.

Règles :
1. Chaque affirmation médicale (dose, seuil, indication, contre-indication, interaction, conduite à tenir) s'appuie sur un document fourni, que tu cites. Recopie les doses, les seuils, les unités et les classes et niveaux de recommandation exactement comme dans la source (traduis le texte en français, jamais les chiffres).
2. N'utilise pas tes connaissances générales pour compléter. Si les documents ne permettent pas de répondre, écris exactement « ${SANS_REPONSE} » puis, en une phrase, le type de source qu'il faudrait ajouter à la bibliothèque.
3. Si les documents ne répondent qu'à une partie de la question, réponds à cette partie et dis clairement ce qui n'est pas couvert.
4. Donne la classe (I, IIa, IIb, III) et le niveau (A, B, C) de la recommandation ESC quand le passage les indique, et l'année de la recommandation.
5. Si un résumé clinique anonyme du patient est fourni, applique les sources à ce patient (par exemple l'adaptation au DFG ou au poids) et signale les données qui manquent pour conclure.
6. Réponse courte et structurée : phrases brèves, listes quand c'est utile, sans formule de politesse ni avertissement général. Le médecin garde la décision.`;

// Mots-clés de recherche, en anglais et en français
async function termesRecherche(question: string, contexte: string | null) {
  const reponse = await anthropic().beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    // Si un filtre de sécurité refuse la demande à tort, l'API la relance sur le modèle de repli recommandé
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: schemaTermes } },
    system: [{ type: "text", text: CONSIGNES_TERMES, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `${contexte ? `Résumé clinique du patient :\n${contexte}\n\n` : ""}Question :\n${question}`,
      },
    ],
  });
  const texte = reponse.content.find((b): b is BetaTextBlock => b.type === "text")?.text ?? "{}";
  const brut = JSON.parse(texte) as { en?: unknown; fr?: unknown };
  const liste = (v: unknown) =>
    Array.isArray(v) ? v.filter((t): t is string => typeof t === "string").map((t) => t.slice(0, 60)) : [];
  return { en: liste(brut.en).slice(0, 20), fr: liste(brut.fr).slice(0, 20) };
}

const libelleType = (type: string) => typesSource.find((t) => t.cle === type)?.libelle ?? type;

// Rassemble les blocs de texte de la réponse et leurs citations (renvoyant aux passages transmis)
function blocs(contenu: BetaContentBlock[], nbPassages: number): Bloc[] {
  const liste: Bloc[] = [];
  for (const b of contenu) {
    if (b.type !== "text") continue;
    const citations = (b.citations ?? []).flatMap((c) =>
      c.type === "char_location" && c.document_index < nbPassages
        ? [{ passage: c.document_index, cite: c.cited_text.trim() }]
        : [],
    );
    // Les blocs sans citation qui se suivent sont réunis, pour un affichage plus lisible
    const precedent = liste.at(-1);
    if (!citations.length && precedent && !precedent.citations.length) precedent.texte += b.text;
    else liste.push({ texte: b.text, citations });
  }
  return liste;
}

export async function repondre(question: string, contexte: string | null): Promise<Reponse> {
  const termes = await termesRecherche(question, contexte);
  const trouves: Passage[] = await rechercherPassages(termes);
  const passages = trouves.map((p) => ({
    id: p.id,
    page: p.page,
    texte: p.texte,
    source: { id: p.source.id, libelle: libelleSource(p.source), type: p.source.type, url: p.source.url },
  }));
  if (!passages.length) {
    return {
      blocs: [{ texte: SANS_REPONSE, citations: [] }],
      passages: [],
      termes,
      contexte,
      sansReponse: true,
    };
  }

  const reponse = await anthropic().beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    // Si un filtre de sécurité refuse la demande à tort, l'API la relance sur le modèle de repli recommandé
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: [{ type: "text", text: CONSIGNES_REPONSE, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...passages.map((p) => ({
            type: "document" as const,
            source: { type: "text" as const, media_type: "text/plain" as const, data: p.texte },
            title: `${p.source.libelle}${p.page ? ` — p. ${p.page}` : ""}`,
            context: libelleType(p.source.type),
            citations: { enabled: true },
          })),
          {
            type: "text" as const,
            text: `${contexte ? `Résumé clinique anonyme du patient :\n${contexte}\n\n` : ""}Question :\n${question}`,
          },
        ],
      },
    ],
  });
  const resultat = blocs(reponse.content, passages.length);
  const texte = resultat.map((b) => b.texte).join("");
  return {
    blocs: resultat.length ? resultat : [{ texte: SANS_REPONSE, citations: [] }],
    passages,
    termes,
    contexte,
    sansReponse: !resultat.length || texte.trim().startsWith(SANS_REPONSE.slice(0, -1)),
  };
}

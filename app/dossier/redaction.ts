// Rédaction d'un compte rendu à partir d'une dictée : le prompt du cabinet (prompts/redaction.ts), les extraits utiles de
// la bibliothèque (recommandations ESC, RCP…) et, si on est dans un dossier, le résumé clinique anonyme du patient.
// Le médecin relit, corrige et enregistre : rien n'est conservé ici. Clé : ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { cabinet } from "../cabinet";
import { termesRecherche } from "./assistant";
import { libelleSource, rechercherPassages } from "./bibliotheque";
import { blocReferences, promptRedaction, separerVerifications } from "./prompts/redaction";
import { modeles } from "./prompts/modeles";

// Types d'examens rédigés ici (la consultation a son propre formulaire)
export const typesRedaction = Object.keys(modeles).filter((t) => t !== "Consultation");

export type CompteRendu = { compteRendu: string; verifications: string[]; sources: string[] };

let client: Anthropic | null = null;

export async function rediger(type: string, dictee: string, contexte: string | null): Promise<CompteRendu> {
  client ??= new Anthropic();
  // Extraits de la bibliothèque en lien avec l'examen et la dictée (sans passage trouvé, le prompt s'en passe)
  const termes = await termesRecherche(`${type} : ${dictee}`.slice(0, 1500), contexte);
  const passages = await rechercherPassages(termes, 8);
  const references = passages.map((p) => ({ titre: libelleSource(p.source), page: p.page, texte: p.texte }));

  const reponse = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    // Si un filtre de sécurité refuse la demande à tort, l'API la relance sur le modèle de repli recommandé
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    // Prompt identique d'une demande à l'autre : l'API le met en cache
    system: [
      {
        type: "text",
        text: promptRedaction({ medecin: cabinet.medecin, ville: cabinet.adresse.ville }),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          contexte ? `# RÉSUMÉ CLINIQUE ANONYME DU PATIENT\n${contexte}` : "",
          references.length ? blocReferences(references) : "",
          `# DEMANDE\nType d'examen : ${type}\nRédige le compte rendu à partir de cette dictée :\n${dictee}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });
  if (reponse.stop_reason === "refusal") throw new Error("La rédaction a été refusée");
  if (reponse.stop_reason === "max_tokens") throw new Error("Dictée trop longue pour la rédaction");
  const texte = reponse.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const { compteRendu, verifications } = separerVerifications(texte);
  if (!compteRendu) throw new Error("Réponse vide");
  return { compteRendu, verifications: verifications.slice(0, 5), sources: references.map((r) => r.titre) };
}

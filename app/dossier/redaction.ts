// Rédaction d'un compte rendu à partir d'une dictée : le prompt du cabinet (prompts/redaction.ts), les extraits utiles de
// la bibliothèque (recommandations ESC, RCP…) et, si on est dans un dossier, le résumé clinique anonyme du patient.
// Le médecin relit, corrige et enregistre : rien n'est conservé ici. Clé : ANTHROPIC_API_KEY.

import { cabinet } from "../cabinet";
import { termesRecherche } from "./assistant";
import { libelleSource, rechercherPassages } from "./bibliotheque";
import { appelerIA } from "./ia/appel";
import { blocReferences, promptRedaction, separerVerifications } from "./prompts/redaction";
import { modeles } from "./prompts/modeles";

// Types d'examens rédigés ici (la consultation a son propre formulaire)
export const typesRedaction = Object.keys(modeles).filter((t) => t !== "Consultation");

// Références jointes à la demande, numérotées R1, R2… comme dans le texte : le passage permet d'ouvrir le document cité
export type ReferenceJointe = { repere: string; passageId: number; titre: string; page: number | null; url: string; extrait: string };
export type CompteRendu = { compteRendu: string; verifications: string[]; references: ReferenceJointe[] };

// Repères [R1], [R2]… cités dans un texte
const reperesCites = (texte: string) => [...texte.matchAll(/\[R(\d+)\]/g)].map((m) => Number(m[1]));

export async function rediger(
  type: string,
  dictee: string,
  contexte: string | null,
  superieur = false,
): Promise<CompteRendu> {
  // Extraits de la bibliothèque en lien avec l'examen et la dictée (sans passage trouvé, le prompt s'en passe)
  const termes = await termesRecherche(`${type} : ${dictee}`.slice(0, 1500), contexte);
  const passages = await rechercherPassages(termes, 8);
  const references = passages.map((p) => ({ titre: libelleSource(p.source), page: p.page, texte: p.texte }));

  const reponse = await appelerIA({
    tache: "redaction",
    // Prompt identique d'une demande à l'autre : l'API le met en cache
    consignes: promptRedaction({ medecin: cabinet.medecin, ville: cabinet.adresse.ville }),
    contenu: [
      contexte ? `# RÉSUMÉ CLINIQUE ANONYME DU PATIENT\n${contexte}` : "",
      references.length ? blocReferences(references) : "",
      `# DEMANDE\nType d'examen : ${type}\nRédige le compte rendu à partir de cette dictée :\n${dictee}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    maxTokens: 8000,
    // Texte vide, ou repère de référence qui ne correspond à aucun extrait fourni : à refaire sur le modèle supérieur
    controle: (t) =>
      Boolean(separerVerifications(t).compteRendu) && reperesCites(t).every((n) => n >= 1 && n <= passages.length),
    superieur,
  });
  if (reponse.arret === "refusal") throw new Error("La rédaction a été refusée");
  if (reponse.arret === "max_tokens") throw new Error("Dictée trop longue pour la rédaction");
  const texte = reponse.texte;
  const { compteRendu, verifications } = separerVerifications(texte);
  if (!compteRendu) throw new Error("Réponse vide");
  return {
    compteRendu,
    verifications: verifications.slice(0, 5),
    references: passages.map((p, i) => ({
      repere: `R${i + 1}`,
      passageId: p.id,
      titre: libelleSource(p.source),
      page: p.page,
      url: p.source.url,
      extrait: p.texte.slice(0, 300),
    })),
  };
}

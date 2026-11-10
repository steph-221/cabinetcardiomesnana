// Vérification des seuils cliniques contre la bibliothèque : pour chaque règle de l'inventaire (comptes-rendus/seuils.ts),
// l'assistant cherche les passages utiles, dit s'ils confirment ou contredisent la règle et recopie la phrase qui le montre.
// La phrase est contrôlée mot pour mot dans le texte du passage : sans phrase retrouvée, il n'y a pas de verdict.
// L'assistant ne fait que proposer. Le médecin lit le passage, puis valide ou demande une correction : rien n'est
// considéré comme vérifié sans lui. Clé : ANTHROPIC_API_KEY.

import { appelerIA } from "./ia/appel";
import { base } from "./base";
import { libelleSource, rechercherPassages } from "./bibliotheque";
import { trouverSeuil, type ReferenceSeuil } from "./comptes-rendus/seuils";

const normaliser = (t: string) => t.normalize("NFC").replace(/\s+/g, " ").trim();

// La phrase proposée doit se retrouver mot pour mot dans le passage (aux espaces et retours à la ligne près)
export const citationDansPassage = (passage: string, citation: string) => {
  const c = normaliser(citation);
  return c.length > 0 && normaliser(passage).includes(c);
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "explication", "passage", "citation"],
  properties: {
    verdict: { type: "string", enum: ["confirme", "contredit", "non_tranche"] },
    explication: { type: "string" },
    passage: { type: "integer" },
    citation: { type: "string" },
  },
};

const CONSIGNES = `Tu aides un cardiologue à vérifier une règle clinique appliquée par un logiciel de comptes rendus, en la comparant à des extraits de recommandations de sa bibliothèque.

Règles :
1. Réponds UNIQUEMENT d'après les extraits fournis, jamais d'après tes connaissances.
2. verdict « confirme » : un extrait énonce la même valeur ou la même règle. « contredit » : un extrait énonce une valeur ou une règle différente (dis laquelle dans l'explication). « non_tranche » : les extraits ne traitent pas ce point précis, ou ne permettent pas de conclure.
3. « passage » : le numéro de l'extrait qui justifie ton verdict. « citation » : UNE phrase recopiée mot pour mot de cet extrait, de 300 caractères au plus, avec la valeur ou la règle. Sans extrait justificatif (non_tranche), passage = 0 et citation = chaîne vide.
4. « explication » : deux phrases au plus, en français, dites au médecin ce que dit l'extrait et en quoi il confirme ou contredit la règle.
5. Une valeur proche mais différente (par exemple 470 ms au lieu de 450 ms) est une contradiction. Signale aussi quand la source donne plusieurs valeurs selon le sexe, l'âge ou la méthode.
6. Le médecin garde la décision : tu ne fais que proposer.`;


const versReference = (l: Record<string, unknown>): ReferenceSeuil => ({
  seuil: l.seuil as string,
  verdict: l.verdict as ReferenceSeuil["verdict"],
  explication: l.explication as string,
  citation: l.citation as string | null,
  passageId: l.passage_id as number | null,
  sourceTitre: l.source_titre as string | null,
  page: l.page as number | null,
  url: l.url as string | null,
  valide: l.valide as ReferenceSeuil["valide"],
  validePar: l.valide_par as string,
  commentaire: l.commentaire as string,
});

export async function lireReferences(): Promise<Record<string, ReferenceSeuil>> {
  const sql = await base();
  const lignes = await sql`SELECT * FROM seuils_verifies`;
  return Object.fromEntries(lignes.map((l) => [l.seuil as string, versReference(l)]));
}

async function enregistrer(r: Omit<ReferenceSeuil, "valide" | "validePar" | "commentaire">) {
  const sql = await base();
  // Une nouvelle lecture efface l'ancienne validation : le médecin doit relire ce qui est affiché maintenant
  const [l] = await sql`
    INSERT INTO seuils_verifies (seuil, verdict, explication, citation, passage_id, source_titre, page, url)
    VALUES (${r.seuil}, ${r.verdict}, ${r.explication}, ${r.citation}, ${r.passageId}, ${r.sourceTitre}, ${r.page}, ${r.url})
    ON CONFLICT (seuil) DO UPDATE SET verdict = EXCLUDED.verdict, explication = EXCLUDED.explication,
      citation = EXCLUDED.citation, passage_id = EXCLUDED.passage_id, source_titre = EXCLUDED.source_titre,
      page = EXCLUDED.page, url = EXCLUDED.url, propose_le = now(),
      valide = '', valide_par = '', valide_le = NULL, commentaire = ''
    RETURNING *`;
  return versReference(l);
}

export async function verifierSeuil(id: string): Promise<ReferenceSeuil> {
  const seuil = trouverSeuil(id);
  if (!seuil) throw new Error("Règle inconnue");
  const passages = await rechercherPassages({ en: seuil.motsEn, fr: seuil.motsFr }, 6);
  const sans = (explication: string) =>
    enregistrer({ seuil: id, verdict: "aucune_source", explication, citation: null, passageId: null, sourceTitre: null, page: null, url: null });
  if (!passages.length) {
    return sans(`Aucun passage de la bibliothèque ne correspond. Ajoutez la recommandation citée (${seuil.source}) à la bibliothèque, ou vérifiez la règle dans le document.`);
  }

  const reponse = await appelerIA({
    tache: "seuil",
    consignes: CONSIGNES,
    schema,
    maxTokens: 2000,
    contenu: `Règle appliquée par le logiciel : ${seuil.regle}\nSource citée par le logiciel : ${seuil.source}\n\nExtraits de la bibliothèque :\n${passages
      .map((p, i) => `[${i + 1}] ${libelleSource(p.source)}${p.page ? ` — p. ${p.page}` : ""}\n${p.texte}`)
      .join("\n\n")}`,
  });
  if (reponse.arret === "refusal" || reponse.arret === "max_tokens") {
    return sans("La vérification automatique n'a pas abouti. Réessayez ou vérifiez la règle dans le document.");
  }
  const texte = reponse.texte || "{}";
  const brut = JSON.parse(texte) as { verdict?: string; explication?: string; passage?: number; citation?: string };
  const passage = passages[(brut.passage ?? 0) - 1];
  const citation = normaliser(brut.citation ?? "");
  const retrouvee = Boolean(passage && citationDansPassage(passage.texte, citation));
  const explication = String(brut.explication ?? "").slice(0, 600);

  // Sans phrase retrouvée mot pour mot dans le passage, aucun verdict n'est retenu
  if ((brut.verdict === "confirme" || brut.verdict === "contredit") && retrouvee) {
    return enregistrer({
      seuil: id,
      verdict: brut.verdict,
      explication,
      citation,
      passageId: passage.id,
      sourceTitre: libelleSource(passage.source),
      page: passage.page,
      url: passage.source.url,
    });
  }
  return enregistrer({
    seuil: id,
    verdict: "non_tranche",
    explication:
      brut.verdict === "non_tranche"
        ? explication || "Les extraits trouvés ne traitent pas ce point."
        : "La phrase proposée n'a pas été retrouvée dans le texte : aucun verdict retenu. Vérifiez la règle dans le document.",
    citation: null,
    passageId: null,
    sourceTitre: null,
    page: null,
    url: null,
  });
}

// Validation par le médecin : « conforme » (il a relu la source) ou « à corriger ». « '' » retire la validation.
export async function validerSeuil(id: string, decision: ReferenceSeuil["valide"], par: string, commentaire: string) {
  if (!trouverSeuil(id)) throw new Error("Règle inconnue");
  const sql = await base();
  const [l] = await sql`
    INSERT INTO seuils_verifies (seuil, verdict, explication, valide, valide_par, valide_le, commentaire)
    VALUES (${id}, 'aucune_source', 'Validée sans extrait de la bibliothèque.', ${decision}, ${decision ? par : ""},
      ${decision ? new Date() : null}, ${commentaire})
    ON CONFLICT (seuil) DO UPDATE SET valide = ${decision}, valide_par = ${decision ? par : ""},
      valide_le = ${decision ? new Date() : null}, commentaire = ${commentaire}
    RETURNING *`;
  return versReference(l);
}

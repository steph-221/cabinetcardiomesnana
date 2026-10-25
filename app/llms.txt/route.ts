// Résumé du cabinet en texte simple pour les assistants IA (ChatGPT, Perplexity, Gemini…)
// Format : https://llmstxt.org
import { cabinet, langues } from "../cabinet";
import { getDictionnaire } from "../[lang]/dictionaries";

export function GET() {
  const t = getDictionnaire("fr");
  const { fixe, mobile } = cabinet.telephones;
  const horaires = cabinet.horaires.map((h, i) => `- ${t.infos.jours[i]} : ${h ?? t.infos.ferme}`);

  const texte = [
    `# ${t.nom}`,
    "",
    `> ${t.meta.description}`,
    "",
    `${cabinet.medecin}, ${t.accueil.titreMedecin.toLowerCase()} à Tanger (Maroc). ${t.medecin.presentation}`,
    "",
    "## Coordonnées",
    "",
    `- Adresse : ${t.infos.adresseLignes.join(", ")}`,
    `- Téléphone fixe : ${fixe.numero} (${fixe.lien})`,
    `- Mobile et WhatsApp : ${mobile.numero} (${mobile.lien})`,
    `- Plan : ${cabinet.carte}`,
    `- Langues du site : ${langues.join(", ")}`,
    "",
    "## Horaires",
    "",
    ...horaires,
    "",
    t.infos.horairesNote,
    "",
    "## Soins et examens réalisés au cabinet",
    "",
    ...t.soins.liste.map(({ titre, texte }) => `- ${titre} : ${texte}`),
    "",
    "## Pages",
    "",
    `- [Accueil](${cabinet.site}/fr) : présentation du cabinet, soins, horaires et accès`,
    `- [Prendre rendez-vous en ligne](${cabinet.site}/fr/rendez-vous)`,
    `- [Mentions légales](${cabinet.site}/fr/mentions-legales)`,
    "",
    "## Urgences",
    "",
    `${t.urgence.titre} ${t.urgence.texte}`,
    "",
  ].join("\n");

  return new Response(texte, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

// Sites cardio proposés en un clic dans « Sites et revues » : seules des pages dont la liste a été lue et vérifiée.
// Les podcasts, débats et webinaires se suivent par leur flux RSS (« Autre site, revue ou flux RSS »).

import type { NouveauSite } from "./veille";

export const SITES_PROPOSES: Record<string, NouveauSite & { bouton: string; groupe: "esc" | "revue" }> = {
  esc: {
    groupe: "esc",
    bouton: "Suivre toutes les recommandations de l'ESC",
    nom: "Recommandations de l'ESC",
    adresse: "https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/",
    prefixe: "",
    organisme: "ESC",
    type: "recommandation",
    langue: "en",
  },
  "esc-poche": {
    groupe: "esc",
    bouton: "Suivre les fiches de poche de l'ESC",
    nom: "ESC Pocket Guidelines (fiches de poche)",
    adresse: "https://www.escardio.org/guidelines/clinical-practice-guidelines/pocket-guidelines/",
    prefixe: "",
    organisme: "ESC",
    type: "recommandation",
    langue: "en",
  },
};

// Flux RSS de revues cardio. Leurs adresses sont celles publiées par les éditeurs ; chaque flux est lu dès l'ajout et,
// s'il ne répond pas, l'erreur s'affiche sur sa carte (« Dernière lecture impossible ») et il peut être retiré.
const revues: [cle: string, nom: string, adresse: string][] = [
  ["jacc", "JACC", "https://www.jacc.org/action/showFeed?type=etoc&feed=rss&jc=jacc"],
  ["circulation", "Circulation", "https://www.ahajournals.org/action/showFeed?type=etoc&feed=rss&jc=circ"],
  ["circ-hf", "Circulation: Heart Failure", "https://www.ahajournals.org/action/showFeed?type=etoc&feed=rss&jc=circheartfailure"],
  ["circ-ae", "Circulation: Arrhythmia and Electrophysiology", "https://www.ahajournals.org/action/showFeed?type=etoc&feed=rss&jc=circep"],
  ["jaha", "Journal of the American Heart Association", "https://www.ahajournals.org/action/showFeed?type=etoc&feed=rss&jc=jaha"],
  ["heart", "Heart (BMJ)", "https://heart.bmj.com/rss/current.xml"],
  ["nejm", "New England Journal of Medicine", "https://www.nejm.org/action/showFeed?jc=nejm&type=etoc&feed=rss"],
];
for (const [cle, nom, adresse] of revues) {
  SITES_PROPOSES[`revue-${cle}`] = {
    groupe: "revue",
    bouton: nom,
    nom,
    adresse,
    prefixe: "",
    organisme: nom,
    type: "article",
    langue: "en",
  };
}

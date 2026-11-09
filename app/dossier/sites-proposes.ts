// Sites cardio proposés en un clic dans « Sites et revues » : seules des pages dont la liste a été lue et vérifiée.
// Les podcasts, débats et webinaires se suivent par leur flux RSS (« Autre site, revue ou flux RSS »).

import type { NouveauSite } from "./veille";

export const SITES_PROPOSES: Record<string, NouveauSite & { bouton: string }> = {
  esc: {
    bouton: "Suivre toutes les recommandations de l'ESC",
    nom: "Recommandations de l'ESC",
    adresse: "https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/",
    prefixe: "",
    organisme: "ESC",
    type: "recommandation",
    langue: "en",
  },
  "esc-poche": {
    bouton: "Suivre les fiches de poche de l'ESC",
    nom: "ESC Pocket Guidelines (fiches de poche)",
    adresse: "https://www.escardio.org/guidelines/clinical-practice-guidelines/pocket-guidelines/",
    prefixe: "",
    organisme: "ESC",
    type: "recommandation",
    langue: "en",
  },
};

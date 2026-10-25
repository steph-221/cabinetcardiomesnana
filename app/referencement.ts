// Référencement : liens entre les langues et données structurées pour Google
// et les assistants IA (schema.org).

import { cabinet, langueParDefaut, langues, type Langue } from "./cabinet";
import type { Dictionnaire } from "./[lang]/dictionaries";

// Pages publiques, sans le préfixe de langue
export const pagesPubliques = ["", "/rendez-vous", "/mentions-legales"];

// Adresse canonique de la page et ses versions dans les autres langues
export function alternatesPour(langue: Langue, chemin: string) {
  return {
    canonical: `/${langue}${chemin}`,
    languages: {
      ...Object.fromEntries(langues.map((l) => [l, `/${l}${chemin}`])),
      "x-default": `/${langueParDefaut}${chemin}`,
    },
  };
}

const joursSchema = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function donneesStructurees(langue: Langue, t: Dictionnaire) {
  const url = `${cabinet.site}/${langue}`;
  const { adresse, position, telephones } = cabinet;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["MedicalClinic", "MedicalBusiness"],
        "@id": `${cabinet.site}/#cabinet`,
        name: t.nom,
        alternateName: t.nomCourt,
        description: t.meta.description,
        url,
        image: [
          `${cabinet.site}/cabinet/salle-examen.jpg`,
          `${cabinet.site}/cabinet/facade.jpg`,
          `${cabinet.site}/cabinet/salle-attente.jpg`,
        ],
        telephone: telephones.fixe.lien,
        address: {
          "@type": "PostalAddress",
          streetAddress: adresse.rue,
          postalCode: adresse.codePostal,
          addressLocality: adresse.ville,
          addressRegion: adresse.region,
          addressCountry: adresse.pays,
        },
        geo: { "@type": "GeoCoordinates", ...position },
        hasMap: cabinet.carte,
        areaServed: { "@type": "City", name: "Tanger" },
        medicalSpecialty: "https://schema.org/Cardiovascular",
        isAcceptingNewPatients: true,
        availableLanguage: langues,
        openingHoursSpecification: cabinet.horaires.flatMap((heures, i) => {
          if (!heures) return [];
          const [opens, closes] = heures.split("–").map((h) => h.trim());
          return [{ "@type": "OpeningHoursSpecification", dayOfWeek: joursSchema[i], opens, closes }];
        }),
        availableService: t.soins.liste.map(({ titre, texte }) => ({
          "@type": "MedicalProcedure",
          name: titre,
          description: texte,
        })),
        contactPoint: [telephones.fixe, telephones.mobile].map((tel) => ({
          "@type": "ContactPoint",
          telephone: tel.lien,
          contactType: "reservations",
        })),
        potentialAction: {
          "@type": "ReserveAction",
          target: `${url}/rendez-vous`,
          name: t.nav.rdv,
        },
        employee: { "@id": `${cabinet.site}/#medecin` },
      },
      {
        "@type": "Physician",
        "@id": `${cabinet.site}/#medecin`,
        name: cabinet.medecin,
        jobTitle: t.accueil.titreMedecin,
        medicalSpecialty: "https://schema.org/Cardiovascular",
        url,
        telephone: telephones.fixe.lien,
        address: { "@type": "PostalAddress", addressLocality: adresse.ville, addressCountry: adresse.pays },
        worksFor: { "@id": `${cabinet.site}/#cabinet` },
      },
    ],
  };
}

// Sérialise pour une balise <script>, sans permettre d'injecter du HTML
export const jsonLd = (donnees: object) => JSON.stringify(donnees).replace(/</g, "\\u003c");

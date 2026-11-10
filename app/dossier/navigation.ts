// Navigation de l'espace cabinet : cinq espaces, chacun avec ses pages. Les adresses des pages ne changent pas ;
// seul leur regroupement change. Aucun accès à la base ici : module testable seul.

export type Acces = "tous" | "medical" | "admin";

export type Page = {
  cle: string;
  libelle: string;
  // Chemin après /{lang}/espace ("" = l'agenda)
  chemin: string;
  acces: Acces;
  // Seule cette adresse exacte allume la page (l'agenda ne doit pas s'allumer sur toutes les autres)
  exact?: boolean;
  // Page ouverte par ce chemin pour la secrétaire, quand il diffère
  cheminSecretaire?: string;
};

export type Espace = { cle: string; libelle: string; icone: string; pages: Page[] };

export const espaces: Espace[] = [
  {
    cle: "aujourdhui",
    libelle: "Aujourd'hui",
    icone: "soleil",
    pages: [
      { cle: "journee", libelle: "Ma journée", chemin: "/aujourdhui", acces: "tous" },
      { cle: "a-valider", libelle: "À valider", chemin: "/a-valider", acces: "tous" },
      { cle: "rappels", libelle: "Rappels", chemin: "/rappels", acces: "tous" },
      { cle: "suivis", libelle: "Suivis", chemin: "/suivis", acces: "tous" },
      { cle: "resultats", libelle: "Résultats", chemin: "/resultats", acces: "tous" },
    ],
  },
  {
    cle: "patients",
    libelle: "Patients",
    icone: "dossier",
    pages: [
      { cle: "patients", libelle: "Patients", chemin: "/patients", acces: "tous" },
      { cle: "population", libelle: "Population", chemin: "/population", acces: "medical" },
    ],
  },
  { cle: "agenda", libelle: "Agenda", icone: "agenda", pages: [{ cle: "agenda", libelle: "Agenda", chemin: "", acces: "tous", exact: true }] },
  {
    cle: "savoir",
    libelle: "Savoir",
    icone: "livre",
    pages: [
      { cle: "assistant", libelle: "Assistant", chemin: "/assistant", acces: "medical" },
      { cle: "bibliotheque", libelle: "Bibliothèque", chemin: "/bibliotheque", acces: "medical" },
      { cle: "calculateurs", libelle: "Calculateurs", chemin: "/calculateurs", acces: "medical" },
      { cle: "lexique", libelle: "Lexique", chemin: "/lexique", acces: "medical" },
    ],
  },
  {
    cle: "cabinet",
    libelle: "Cabinet",
    icone: "cabinet",
    pages: [
      { cle: "comptabilite", libelle: "Comptabilité", chemin: "/comptabilite", acces: "tous", cheminSecretaire: "/comptabilite/factures" },
      { cle: "reprise", libelle: "Reprise Word", chemin: "/reprise", acces: "medical" },
      { cle: "modeles-ia", libelle: "Modèles IA", chemin: "/modeles-ia", acces: "admin" },
      { cle: "drive", libelle: "Drive", chemin: "/drive", acces: "admin" },
      { cle: "journal", libelle: "Journal", chemin: "/journal", acces: "admin" },
      { cle: "comptes", libelle: "Comptes", chemin: "/comptes", acces: "admin" },
    ],
  },
];

export type Droits = { medical: boolean; admin: boolean };

const permis = (a: Acces, d: Droits) => a === "tous" || (a === "medical" && d.medical) || (a === "admin" && d.admin);

// Espaces et pages visibles pour ces droits ; un espace sans page visible disparaît
export function espacesVisibles(d: Droits): Espace[] {
  return espaces
    .map((e) => ({ ...e, pages: e.pages.filter((p) => permis(p.acces, d)) }))
    .filter((e) => e.pages.length > 0);
}

// Page et espace allumés pour un chemin (sans la langue) : « /fr/espace/patients/12 » → patients
export function pageDe(pathname: string): { espace: Espace; page: Page } | null {
  const chemin = pathname.replace(/^\/[a-z]{2}\/espace/, "") || "";
  let meilleure: { espace: Espace; page: Page } | null = null;
  for (const espace of espaces) {
    for (const page of espace.pages) {
      const ok = page.exact ? chemin === page.chemin : chemin === page.chemin || chemin.startsWith(`${page.chemin}/`);
      if (ok && (!meilleure || page.chemin.length > meilleure.page.chemin.length)) meilleure = { espace, page };
    }
  }
  return meilleure;
}

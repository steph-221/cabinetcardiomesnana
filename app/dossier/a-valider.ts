// Boîte « À valider » : tout ce que le site a préparé et qui attend un coup d'œil du personnel ou du médecin,
// rassemblé au même endroit. Chaque groupe renvoie à l'écran où l'on traite l'élément.

import { base } from "./base";
import { compterMessages } from "./messages-whatsapp";
import { compterEnRetard } from "./suivis";
import { compterAlertesPrescrits } from "./veille-medicaments";

export type GroupeAValider = {
  cle: "resultats-a-classer" | "resultats-a-relire" | "reprise" | "medicaments" | "seuils" | "suivis" | "messages";
  libelle: string;
  n: number;
  // Chemin après /{lang}/espace
  chemin: string;
  // Réservé aux comptes médicaux
  medical: boolean;
};

const zero = async (promesse: Promise<number>) => {
  try {
    return await promesse;
  } catch (erreur) {
    console.error(erreur);
    return 0;
  }
};

// Compteurs seulement (léger : sert aussi aux pastilles de la barre de navigation)
export async function groupesAValider(aujourdhui: string, medical: boolean): Promise<GroupeAValider[]> {
  const sql = await base();
  const [aClasser, aRelire, reprise, medicaments, seuils, retard, messages] = await Promise.all([
    zero(sql`SELECT count(*)::int AS n FROM resultats_recus WHERE statut = 'a_classer'`.then((r) => r[0].n as number)),
    zero(sql`SELECT count(*)::int AS n FROM resultats_recus WHERE statut = 'a_relire'`.then((r) => r[0].n as number)),
    medical ? zero(sql`SELECT count(*)::int AS n FROM imports WHERE statut = 'a_valider'`.then((r) => r[0].n as number)) : Promise.resolve(0),
    medical ? zero(compterAlertesPrescrits()) : Promise.resolve(0),
    medical ? zero(sql`SELECT count(*)::int AS n FROM seuils_verifies WHERE valide = ''`.then((r) => r[0].n as number)) : Promise.resolve(0),
    zero(compterEnRetard(aujourdhui)),
    zero(compterMessages().then((m) => m.aTraiter)),
  ]);
  const groupes: GroupeAValider[] = [
    { cle: "resultats-a-classer", libelle: "Résultats d'analyses à classer dans un dossier", n: aClasser, chemin: "/resultats", medical: false },
    { cle: "resultats-a-relire", libelle: "Résultats classés automatiquement, à relire", n: aRelire, chemin: "/resultats", medical: false },
    { cle: "messages", libelle: "Messages WhatsApp des patients à traiter", n: messages, chemin: "/messages", medical: false },
    { cle: "suivis", libelle: "Suivis en retard à relancer", n: retard, chemin: "/suivis", medical: false },
    { cle: "reprise", libelle: "Anciens comptes rendus Word à vérifier avant import", n: reprise, chemin: "/reprise", medical: true },
    { cle: "medicaments", libelle: "Médicaments prescrits modifiés sur medicament.ma", n: medicaments, chemin: "/bibliotheque/medicaments", medical: true },
    { cle: "seuils", libelle: "Seuils cliniques proposés par l'assistant, à valider", n: seuils, chemin: "/seuils", medical: true },
  ];
  return groupes;
}

export const total = (groupes: GroupeAValider[]) => groupes.reduce((n, g) => n + g.n, 0);

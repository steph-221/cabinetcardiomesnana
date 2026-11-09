"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../../agenda/session";
import { journaliser } from "../../../../dossier/journal";
import { oublierCopie } from "../../../../dossier/medicaments-ma";
import { marquerTousTraites, marquerTraite, verifierMedicaments } from "../../../../dossier/veille-medicaments";
import type { EtatFormulaire } from "../../formulaire";

// Relance la vérification (une passe limitée dans le temps : à relancer si elle n'est pas terminée)
export async function verifierMaintenant(langue: string): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  try {
    const r = await verifierMedicaments(45_000);
    oublierCopie();
    await journaliser(utilisateur.identifiant, "veille médicaments lancée", null, r.terminee ? "terminée" : `${r.lettresFaites}/26`);
  } catch (erreur) {
    console.error(erreur);
    refresh();
    return { erreur: "La vérification n'a pas pu se faire. Réessayez dans un instant.", valeurs: {} };
  }
  refresh();
  return null;
}

export async function changementVu(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  if (!Number.isInteger(id) || id <= 0) return;
  await marquerTraite(id, utilisateur.identifiant);
  refresh();
}

export async function tousVus(langue: string) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  // Les alertes sur des médicaments prescrits ne se ferment qu'une par une
  await marquerTousTraites(utilisateur.identifiant, ["ajout"]);
  refresh();
}

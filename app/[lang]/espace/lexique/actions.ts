"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import { apprendre, oublier } from "../../../dossier/lexique";
import { echec, texte, type EtatFormulaire } from "../formulaire";

// Depuis la relecture d'une dictée : « bi soprolol » → « bisoprolol »
export async function ajouterAuLexique(langue: string, entendu: string, correct: string) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const e = entendu.trim().slice(0, 100);
  const c = correct.trim().slice(0, 100);
  if (!e || !c || e.toLowerCase() === c.toLowerCase()) return false;
  await apprendre(e, c, utilisateur.identifiant);
  return true;
}

export async function nouveauMot(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const entendu = texte(formData, "entendu", 100);
  const correct = texte(formData, "correct", 100);
  if (!entendu || !correct) return echec("Indiquez le mot entendu et le mot juste.", formData);
  await apprendre(entendu, correct, utilisateur.identifiant);
  refresh();
  return null;
}

export async function retirerMot(langue: string, id: number) {
  await exigerUtilisateur(langue, "medical");
  await oublier(id);
  refresh();
}

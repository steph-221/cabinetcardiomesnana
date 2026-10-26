"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import { cabinet } from "../../../cabinet";
import { repondre } from "../../../dossier/assistant";
import { claudeConfigure } from "../../../dossier/dictee";
import { journaliser } from "../../../dossier/journal";
import {
  creerFiche,
  enregistrerQuestion,
  lireQuestion,
  noterQuestion,
  resumeClinique,
} from "../../../dossier/questions";
import { echec, texte, type EtatFormulaire } from "../formulaire";

export async function poserQuestion(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  if (!claudeConfigure()) return echec("L'assistant n'est pas configuré (clé ANTHROPIC_API_KEY).", formData);
  const question = texte(formData, "question", 2000);
  if (question.length < 5) return echec("Posez votre question.", formData);
  const patient = Number(formData.get("patient"));
  const patientId = Number.isInteger(patient) && patient > 0 ? patient : null;

  let id: number;
  try {
    const contexte = patientId ? await resumeClinique(patientId) : null;
    const reponse = await repondre(question, contexte);
    id = await enregistrerQuestion(question, patientId, reponse, utilisateur.identifiant);
    const cites = new Set(reponse.blocs.flatMap((b) => b.citations.map((c) => reponse.passages[c.passage]?.source.id)));
    await journaliser(
      utilisateur.identifiant,
      "question à l'assistant",
      patientId,
      reponse.sansReponse ? "sans réponse dans la bibliothèque" : `${cites.size} source(s) citée(s)`,
    );
  } catch (erreur) {
    console.error(erreur);
    return echec("L'assistant n'a pas pu répondre. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/assistant/${id}`);
}

export async function noterReponse(langue: string, id: number, note: -1 | 1, formData: FormData) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await noterQuestion(id, note === 1 ? 1 : -1, texte(formData, "commentaire", 1000));
  await journaliser(utilisateur.identifiant, note === 1 ? "réponse approuvée" : "réponse contestée", null, `n° ${id}`);
  refresh();
}

export async function enFiche(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const question = await lireQuestion(id);
  if (!question || question.ficheId || question.reponse.sansReponse) return;
  await creerFiche(question, cabinet.medecin, utilisateur.identifiant);
  await journaliser(utilisateur.identifiant, "fiche validée ajoutée à la bibliothèque", null, `question n° ${id}`);
  refresh();
}

"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import { ecrireReglage } from "../../../dossier/ia/usage";
import { estTache, efforts, niveaux, type Effort, type Niveau } from "../../../dossier/ia/taches";
import { journaliser } from "../../../dossier/journal";

// Réglage d'une tâche (administrateur) ; « defaut » rétablit le réglage de départ
export async function regler(langue: string, tache: string, formData: FormData) {
  const utilisateur = await exigerUtilisateur(langue, "admin");
  if (!estTache(tache)) return;
  const niveau = String(formData.get("niveau") ?? "");
  const effort = String(formData.get("effort") ?? "");
  const reinit = formData.get("action") === "defaut";
  if (reinit) await ecrireReglage(tache, null);
  else if ((niveaux as readonly string[]).includes(niveau) && (efforts as readonly string[]).includes(effort)) {
    await ecrireReglage(tache, { niveau: niveau as Niveau, effort: effort as Effort });
  } else return;
  await journaliser(utilisateur.identifiant, "réglage IA modifié", null, reinit ? `${tache} : réglage de départ` : `${tache} : ${niveau}, effort ${effort}`);
  refresh();
}

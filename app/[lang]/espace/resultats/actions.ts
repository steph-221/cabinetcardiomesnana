"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import {
  classerResultat,
  confirmerResultat,
  detacherResultat,
  ignorerResultat,
} from "../../../dossier/resultats";

export async function classer(langue: string, id: number, patientId: number) {
  const utilisateur = await exigerUtilisateur(langue, "tous");
  try {
    await classerResultat(id, patientId, utilisateur.identifiant, "valide");
  } catch (erreur) {
    console.error(erreur);
  }
  refresh();
}

export async function confirmer(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "tous");
  await confirmerResultat(id, utilisateur.identifiant);
  refresh();
}

export async function detacher(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "tous");
  await detacherResultat(id, utilisateur.identifiant);
  refresh();
}

export async function ignorer(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "tous");
  await ignorerResultat(id, utilisateur.identifiant);
  refresh();
}

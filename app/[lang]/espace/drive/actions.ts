"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import { deconnecterDrive } from "../../../dossier/drive";
import { journaliser } from "../../../dossier/journal";

export async function deconnexionDrive(langue: string) {
  const admin = await exigerUtilisateur(langue, "admin");
  await deconnecterDrive();
  await journaliser(admin.identifiant, "Google Drive déconnecté", null);
  refresh();
}

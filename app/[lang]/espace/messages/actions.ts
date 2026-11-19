"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import { journaliser } from "../../../dossier/journal";
import { marquerTraite } from "../../../dossier/messages-whatsapp";

export async function traiter(langue: string, id: number, traite: boolean) {
  const utilisateur = await exigerUtilisateur(langue);
  if (!Number.isInteger(id) || id <= 0) return;
  await marquerTraite(id, utilisateur.identifiant, traite);
  await journaliser(utilisateur.identifiant, traite ? "message WhatsApp traité" : "message WhatsApp rouvert", null, `n° ${id}`);
  refresh();
}

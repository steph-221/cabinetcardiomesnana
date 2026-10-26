"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import {
  ajouterPages,
  changerStatut,
  creerSource,
  estTypeSource,
  supprimerSource,
  terminerSource,
  type NouvelleSource,
} from "../../../dossier/bibliotheque";
import { journaliser } from "../../../dossier/journal";

// L'import se fait en trois temps depuis le navigateur, qui lit lui-même le PDF : création de la source,
// envoi du texte par lots de pages (les PDF de l'ESC dépassent la taille d'envoi autorisée), puis clôture.

export async function commencerImport(
  langue: string,
  meta: { titre: string; organisme: string; annee: string; type: string; langue: string; url: string },
): Promise<{ id: number } | { erreur: string }> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const titre = String(meta.titre ?? "")
    .trim()
    .slice(0, 200);
  if (!titre) return { erreur: "Indiquez le titre de la source." };
  const annee = String(meta.annee ?? "").trim() ? Number(meta.annee) : null;
  if (annee !== null && (!Number.isInteger(annee) || annee < 1950 || annee > 2100)) {
    return { erreur: "Vérifiez l'année." };
  }
  if (!estTypeSource(meta.type)) return { erreur: "Choisissez le type de source." };
  const url = String(meta.url ?? "")
    .trim()
    .slice(0, 500);
  if (url && !/^https:\/\/\S+$/.test(url)) return { erreur: "Le lien doit commencer par https://." };
  const source: NouvelleSource = {
    titre,
    organisme: String(meta.organisme ?? "")
      .trim()
      .slice(0, 100),
    annee,
    type: meta.type,
    langue: meta.langue === "en" ? "en" : "fr",
    url,
  };
  const id = await creerSource(source, utilisateur.identifiant);
  return { id };
}

export async function envoyerPages(langue: string, sourceId: number, pages: { page: number | null; texte: string }[]) {
  await exigerUtilisateur(langue, "medical");
  if (!Array.isArray(pages) || pages.length > 50) throw new Error("Lot de pages invalide");
  const propres = pages.map((p) => ({
    page: Number.isInteger(p.page) && p.page! > 0 ? p.page : null,
    texte: String(p.texte ?? "").slice(0, 60000),
  }));
  return ajouterPages(sourceId, propres);
}

export async function terminerImport(langue: string, sourceId: number, pages: number, titre: string) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const ok = await terminerSource(sourceId, Math.max(0, Math.floor(pages)));
  if (ok) await journaliser(utilisateur.identifiant, "source ajoutée à la bibliothèque", null, titre.slice(0, 200));
  else await supprimerSource(sourceId);
  refresh();
  return ok;
}

export async function basculerStatut(langue: string, sourceId: number, statut: "en_vigueur" | "remplacee") {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await changerStatut(sourceId, statut === "remplacee" ? "remplacee" : "en_vigueur");
  await journaliser(
    utilisateur.identifiant,
    statut === "remplacee" ? "source marquée remplacée" : "source remise en vigueur",
    null,
    `n° ${sourceId}`,
  );
  refresh();
}

export async function retirerSource(langue: string, sourceId: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await supprimerSource(sourceId);
  await journaliser(utilisateur.identifiant, "source retirée de la bibliothèque", null, `n° ${sourceId}`);
  refresh();
}

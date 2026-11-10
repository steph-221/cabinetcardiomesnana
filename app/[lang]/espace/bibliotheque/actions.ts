"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../agenda/session";
import {
  ajouterPages,
  changerStatut,
  creerSource,
  estTypeSource,
  sourceParDoi,
  sourcesRemplacables,
  supprimerSource,
  terminerSource,
  type NouvelleSource,
} from "../../../dossier/bibliotheque";
import { journaliser } from "../../../dossier/journal";
import { telecharger } from "../../../dossier/lecture-site";
import { lienDoi, metadonneesCrossref } from "../../../dossier/resolution";
import { publicationParDoi } from "../../../dossier/veille";

// L'import se fait en trois temps depuis le navigateur, qui lit lui-même le PDF : création de la source,
// envoi du texte par lots de pages (les PDF de l'ESC dépassent la taille d'envoi autorisée), puis clôture.

export async function commencerImport(
  langue: string,
  meta: {
    titre: string;
    organisme: string;
    annee: string;
    type: string;
    langue: string;
    url: string;
    publication?: number | null;
    doi?: string;
  },
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
    publicationId: Number.isInteger(meta.publication) && meta.publication! > 0 ? meta.publication! : null,
    doi: /^10\.\d{4,9}\/\S+$/.test(String(meta.doi ?? "")) ? String(meta.doi).slice(0, 200).toLowerCase() : "",
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
  // Anciennes éditions du même sujet : proposées pour être marquées « remplacées »
  const remplacables = ok ? await sourcesRemplacables(sourceId).catch(() => []) : [];
  refresh();
  return { ok, remplacables };
}

export type Identification =
  | { trouve: false }
  | {
      trouve: true;
      doi: string;
      // Source déjà dans la bibliothèque pour ce DOI
      existante: { id: number; titre: string } | null;
      publication: number | null;
      titre: string;
      annee: number | null;
      organisme: string;
      type: string;
      langue: "fr" | "en";
      url: string;
    };

// Reconnaît un document déposé d'après son DOI : publication suivie, sinon métadonnées publiques (Crossref).
// Les champs du formulaire se remplissent alors seuls.
export async function identifierDocument(langue: string, doi: string): Promise<Identification> {
  await exigerUtilisateur(langue, "medical");
  const propre = String(doi ?? "").trim().toLowerCase().slice(0, 200);
  if (!/^10\.\d{4,9}\/\S+$/.test(propre)) return { trouve: false };
  const [existante, suivie] = await Promise.all([sourceParDoi(propre), publicationParDoi(propre)]);
  const base = { trouve: true as const, doi: propre, existante: existante ? { id: existante.id, titre: existante.titre } : null };
  if (suivie) {
    return { ...base, publication: suivie.id, titre: suivie.titre, annee: suivie.annee, organisme: suivie.organisme, type: suivie.type, langue: suivie.langue, url: lienDoi(propre) };
  }
  const meta = await metadonneesCrossref(propre, async (u) => (await telecharger(u)).texte);
  if (!meta) return { ...base, publication: null, titre: "", annee: null, organisme: "", type: "article", langue: "en", url: lienDoi(propre) };
  const organisme = /european heart journal|esc/i.test(`${meta.revue} ${meta.titre}`) && /\bESC\b/.test(meta.titre) ? "ESC" : meta.revue;
  const type = /guidelines?|consensus|recommandations?/i.test(meta.titre) ? "recommandation" : "article";
  return { ...base, publication: null, titre: meta.titre, annee: meta.annee, organisme, type, langue: "en", url: lienDoi(propre) };
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

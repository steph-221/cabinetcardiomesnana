// Réception d'un résultat d'analyses envoyé par le script Google du cabinet (voir RESULTATS.md).
// Protégé par un secret partagé (variable RESULTATS_SECRET), pas par une session.

import { timingSafeEqual } from "node:crypto";
import { estJour } from "../../agenda/creneaux";
import { compter, lire } from "../../agenda/limite";
import { baseConfiguree } from "../../dossier/base";
import { typesFichier, TAILLE_MAX } from "../../dossier/examens";
import { recevoirResultat } from "../../dossier/resultats";

const erreur = (message: string, status: number) => Response.json({ erreur: message }, { status });

function secretValide(request: Request) {
  const attendu = process.env.RESULTATS_SECRET;
  if (!attendu || attendu.length < 24) return false;
  const recu = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Essais de secret ratés tolérés par adresse et par quart d'heure
const ECHECS_MAX = 10;
const FENETRE_ECHECS = 15 * 60;
// Un envoi plus vieux que ça est refusé (un envoi capturé ne peut pas être rejoué plus tard)
const AGE_MAX_S = 300;

const adresse = (request: Request) =>
  (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "inconnue").trim();

export async function POST(request: Request) {
  if (!process.env.RESULTATS_SECRET) return erreur("Réception des résultats non activée.", 503);

  // Adresse déjà bloquée pour avoir deviné des secrets à la chaîne : on ne regarde même plus le secret
  const cle = `resultats:echecs:${adresse(request)}`;
  if ((await lire(cle)) >= ECHECS_MAX) return erreur("Trop d'essais. Réessayez plus tard.", 429);
  if (!secretValide(request)) {
    const echecs = await compter(cle, FENETRE_ECHECS);
    return echecs !== null && echecs > ECHECS_MAX ? erreur("Trop d'essais. Réessayez plus tard.", 429) : erreur("Accès refusé.", 401);
  }

  // Horodatage (secondes) envoyé par le script du cabinet. Facultatif tant que le script n'est pas mis à jour ;
  // obligatoire avec RESULTATS_HORODATAGE_OBLIGATOIRE=1 (voir RESULTATS.md).
  const horodatage = request.headers.get("x-horodatage");
  if (horodatage !== null || process.env.RESULTATS_HORODATAGE_OBLIGATOIRE === "1") {
    const secondes = Number(horodatage);
    if (!horodatage || !Number.isFinite(secondes) || Math.abs(Date.now() / 1000 - secondes) > AGE_MAX_S) {
      return erreur("Envoi trop ancien ou horodatage manquant.", 400);
    }
  }
  if (!baseConfiguree()) return erreur("Base de données non configurée.", 503);

  const f = await request.formData().catch(() => null);
  if (!f) return erreur("Envoi incomplet.", 400);
  const fichier = f.get("fichier");
  const texte = (nom: string, longueur: number) => String(f.get(nom) ?? "").trim().slice(0, longueur);
  const date = texte("date", 10);
  const messageId = texte("messageId", 200);

  if (!(fichier instanceof File) || fichier.size === 0) return erreur("Aucun fichier reçu.", 400);
  if (!typesFichier.includes(fichier.type)) return erreur("Seuls les PDF et les photos sont acceptés.", 400);
  if (fichier.size > TAILLE_MAX) return erreur("Le fichier dépasse 4 Mo.", 413);
  if (!estJour(date) || !messageId) return erreur("Date ou identifiant du message manquant.", 400);

  try {
    const r = await recevoirResultat({
      messageId,
      nomFichier: (fichier.name || "resultat.pdf").slice(0, 200),
      labo: texte("labo", 100),
      expediteur: texte("expediteur", 200),
      sujet: texte("sujet", 300),
      corps: texte("corps", 3000),
      date,
      fichier,
    });
    return Response.json("doublon" in r ? { doublon: true } : r);
  } catch (e) {
    console.error(e);
    return erreur("Enregistrement impossible.", 500);
  }
}

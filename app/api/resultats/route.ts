// Réception d'un résultat d'analyses envoyé par le script Google du cabinet (voir RESULTATS.md).
// Protégé par un secret partagé (variable RESULTATS_SECRET), pas par une session.

import { timingSafeEqual } from "node:crypto";
import { estJour } from "../../agenda/creneaux";
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

export async function POST(request: Request) {
  if (!process.env.RESULTATS_SECRET) return erreur("Réception des résultats non activée.", 503);
  if (!secretValide(request)) return erreur("Accès refusé.", 401);
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

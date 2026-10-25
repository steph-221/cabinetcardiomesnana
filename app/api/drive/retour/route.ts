// Retour de Google après le consentement : enregistre l'accès à Google Drive

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { utilisateurConnecte } from "../../../agenda/session";
import { verifier } from "../../../dossier/chiffrement";
import { connecterDrive } from "../../../dossier/drive";
import { journaliser } from "../../../dossier/journal";

export async function GET(request: NextRequest) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur?.admin) return new Response("Réservé à l'administrateur", { status: 403 });

  const parametres = request.nextUrl.searchParams;
  const jar = await cookies();
  const nonce = jar.get("drive_etat")?.value;
  jar.delete({ name: "drive_etat", path: "/api/drive" });
  const page = (resultat: string) => Response.redirect(`${request.nextUrl.origin}/fr/espace/drive?resultat=${resultat}`);

  if (!nonce || verifier(parametres.get("state") ?? "") !== nonce) return page("refuse");
  const code = parametres.get("code");
  if (!code) return page("annule");
  try {
    await connecterDrive(code, `${request.nextUrl.origin}/api/drive/retour`, utilisateur.identifiant);
    await journaliser(utilisateur.identifiant, "Google Drive connecté", null);
  } catch (erreur) {
    console.error(erreur);
    return page("erreur");
  }
  return page("connecte");
}

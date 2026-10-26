// Départ de la connexion du compte Google du cabinet à Google Drive (administrateur seulement)

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { utilisateurConnecte } from "../../../agenda/session";
import { signer } from "../../../dossier/chiffrement";
import { driveConfigure, urlConsentement } from "../../../dossier/drive";

export async function GET(request: NextRequest) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur?.admin) return new Response("Réservé à l'administrateur", { status: 403 });
  if (!driveConfigure()) return new Response("Identifiants OAuth Google manquants (voir DOSSIER.md)", { status: 500 });

  // Jeton anti-falsification : la réponse de Google doit revenir avec la même valeur que ce cookie
  const nonce = randomBytes(16).toString("base64url");
  (await cookies()).set("drive_etat", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/drive",
    maxAge: 600,
  });
  return Response.redirect(urlConsentement(`${request.nextUrl.origin}/api/drive/retour`, signer(nonce)));
}

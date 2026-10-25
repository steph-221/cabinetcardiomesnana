// Connexion du personnel (secrétaire, médecin remplaçant…) à l'espace cabinet.
// Les comptes sont définis dans la variable d'environnement COMPTES_PERSONNEL :
//   secretaire:motdepasse1,remplacant:motdepasse2
// La session est un cookie signé avec SESSION_SECRET, valable 12 heures.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "espace_cabinet";
const DUREE = 12 * 3600; // secondes

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum)");
  return s;
};

const empreinte = (texte: string) => createHash("sha256").update(texte).digest();
const signer = (contenu: string) => createHmac("sha256", secret()).update(contenu).digest("base64url");

function comptes() {
  return (process.env.COMPTES_PERSONNEL ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf(":");
      return { identifiant: c.slice(0, i).trim().toLowerCase(), motDePasse: c.slice(i + 1) };
    })
    .filter((c) => c.identifiant && c.motDePasse);
}

// Vérifie l'identifiant et le mot de passe ; renvoie l'identifiant reconnu
export function verifierIdentifiants(identifiant: string, motDePasse: string) {
  const compte = comptes().find((c) => c.identifiant === identifiant.trim().toLowerCase());
  // Compare toujours, même si le compte n'existe pas, pour ne pas révéler les identifiants valides
  const attendu = empreinte(compte?.motDePasse ?? "\0compte-inconnu");
  return compte && timingSafeEqual(attendu, empreinte(motDePasse)) ? compte.identifiant : null;
}

export async function ouvrirSession(identifiant: string) {
  const contenu = Buffer.from(JSON.stringify({ u: identifiant, exp: Math.floor(Date.now() / 1000) + DUREE })).toString(
    "base64url",
  );
  (await cookies()).set(COOKIE, `${contenu}.${signer(contenu)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE,
  });
}

export async function fermerSession() {
  (await cookies()).delete(COOKIE);
}

// Identifiant de la personne connectée, ou null
export async function utilisateurConnecte() {
  const valeur = (await cookies()).get(COOKIE)?.value;
  if (!valeur) return null;
  const [contenu, signature] = valeur.split(".");
  if (!contenu || !signature) return null;
  const attendue = Buffer.from(signer(contenu));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(contenu, "base64url").toString()) as { u: string; exp: number };
    // Un compte retiré de COMPTES_PERSONNEL perd l'accès immédiatement
    if (exp < Date.now() / 1000 || !comptes().some((c) => c.identifiant === u)) return null;
    return u;
  } catch {
    return null;
  }
}

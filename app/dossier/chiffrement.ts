// Chiffrement des secrets enregistrés dans la base (jeton Google Drive…) et signature de petits messages.
// La clé est dérivée de SESSION_SECRET : si elle change, il faut reconnecter Google Drive.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum)");
  return s;
};

const cle = () => createHash("sha256").update(`chiffrement:${secret()}`).digest();

export function chiffrer(texte: string) {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv("aes-256-gcm", cle(), iv);
  const contenu = Buffer.concat([chiffreur.update(texte, "utf8"), chiffreur.final()]);
  return [iv, chiffreur.getAuthTag(), contenu].map((b) => b.toString("base64url")).join(".");
}

export function dechiffrer(valeur: string) {
  const [iv, etiquette, contenu] = valeur.split(".").map((p) => Buffer.from(p, "base64url"));
  const dechiffreur = createDecipheriv("aes-256-gcm", cle(), iv);
  dechiffreur.setAuthTag(etiquette);
  return Buffer.concat([dechiffreur.update(contenu), dechiffreur.final()]).toString("utf8");
}

const signature = (texte: string) => createHmac("sha256", `signature:${secret()}`).update(texte).digest("base64url");

export const signer = (texte: string) => `${texte}.${signature(texte)}`;

// Renvoie le texte signé, ou null si la signature ne correspond pas
export function verifier(valeur: string) {
  const i = valeur.lastIndexOf(".");
  if (i < 1) return null;
  const texte = valeur.slice(0, i);
  const attendue = Buffer.from(signature(texte));
  const recue = Buffer.from(valeur.slice(i + 1));
  return attendue.length === recue.length && timingSafeEqual(attendue, recue) ? texte : null;
}

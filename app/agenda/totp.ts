// Code à usage unique (TOTP, RFC 6238) pour le compte administrateur : Google Authenticator, Authy, 1Password…
// Activé en renseignant TOTP_ADMIN (secret en base32, par exemple généré avec `openssl rand` puis encodé, ou
// celui affiché par l'application d'authentification). Sans cette variable, le mot de passe seul suffit.

import { createHmac, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decoderBase32(texte: string) {
  const propre = texte.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];
  for (const c of propre) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("Secret TOTP invalide (base32 attendu)");
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

export function codeTotp(secret: Buffer, pas: number) {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));
  const h = createHmac("sha1", secret).update(compteur).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

// Pas (de 30 s) pour lequel le code saisi est valable, avec une tolérance d'un pas de chaque côté ; null sinon
export function verifierTotp(secretBase32: string, saisi: string, maintenant = Date.now()) {
  const code = saisi.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const secret = decoderBase32(secretBase32);
  const courant = Math.floor(maintenant / 30_000);
  for (const pas of [courant - 1, courant, courant + 1]) {
    if (timingSafeEqual(Buffer.from(codeTotp(secret, pas)), Buffer.from(code))) return pas;
  }
  return null;
}

export const totpAdminActive = () => Boolean(process.env.TOTP_ADMIN);

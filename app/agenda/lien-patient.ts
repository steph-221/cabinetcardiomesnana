// Lien personnel envoyé au patient pour confirmer ou annuler son rendez-vous, sans compte ni mot de passe.
// L'adresse contient l'identifiant de l'événement et une signature calculée avec SESSION_SECRET : on ne peut ni
// deviner le lien d'un autre patient, ni modifier le rendez-vous visé. Sans SESSION_SECRET, aucun lien n'est créé.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cabinet } from "../cabinet";

const secret = () => {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
};

const signer = (id: string, cle: string) => createHmac("sha256", cle).update(`rdv-gerer:${id}`).digest("base64url").slice(0, 32);

export function signatureRdv(id: string): string | null {
  const cle = secret();
  return cle ? signer(id, cle) : null;
}

export function signatureValide(id: string, signature: string): boolean {
  const cle = secret();
  if (!cle || !id || !signature) return false;
  const attendu = Buffer.from(signer(id, cle));
  const recu = Buffer.from(signature);
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

// Adresse complète du lien, ou null si la signature est impossible
export function lienRdv(id: string, base: string = cabinet.site): string | null {
  const t = signatureRdv(id);
  return t ? `${base}/fr/rendez-vous/gerer?r=${encodeURIComponent(id)}&t=${t}` : null;
}

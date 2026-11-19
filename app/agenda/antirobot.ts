// Protection du formulaire de rendez-vous contre les robots.
// 1. Jeton signé émis à l'affichage de la page : un robot qui appelle directement l'action n'en a pas,
//    et un envoi plus rapide que DELAI_MIN_S après l'affichage n'est pas humain.
// 2. Limites de fréquence (stockage Redis) par adresse IP, par numéro de téléphone et globale.
// Si SESSION_SECRET ou le stockage manquent, la protection concernée est simplement ignorée
// (le site continue de fonctionner, comme avant).

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { commande, stockageConfigure } from "./stockage";

const DELAI_MIN_S = 3;
const DUREE_MAX_S = 6 * 3600;

const secret = () => {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
};

const signer = (contenu: string, cle: string) =>
  createHmac("sha256", cle).update(`rdv-jeton:${contenu}`).digest("base64url");

// À appeler à l'affichage du formulaire
export function creerJeton(maintenant = Date.now()): string {
  const cle = secret();
  if (!cle) return "";
  const contenu = String(Math.floor(maintenant / 1000));
  return `${contenu}.${signer(contenu, cle)}`;
}

export function jetonValide(jeton: string, maintenant = Date.now()): boolean {
  const cle = secret();
  if (!cle) return true;
  const [contenu, signature] = jeton.split(".");
  if (!contenu || !signature || !/^\d+$/.test(contenu)) return false;
  const attendu = Buffer.from(signer(contenu, cle));
  const recu = Buffer.from(signature);
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return false;
  const age = maintenant / 1000 - Number(contenu);
  return age >= DELAI_MIN_S && age <= DUREE_MAX_S;
}

// Incrémente un compteur qui expire après `fenetre` secondes ; vrai si `max` est dépassé
async function depasse(cle: string, max: number, fenetre: number): Promise<boolean> {
  const n = await commande<number>("INCR", cle);
  if (n === 1) await commande("EXPIRE", cle, String(fenetre));
  return n > max;
}

const empreinte = (valeur: string) => createHash("sha256").update(valeur).digest("hex").slice(0, 24);

export async function adresseIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "inconnue").trim();
}

// Vrai si cette demande dépasse les limites : 5/heure par IP, 3/jour par téléphone, 60/heure au total
export async function tropDeDemandes(ip: string, telephone: string): Promise<boolean> {
  if (!stockageConfigure()) return false;
  try {
    const chiffres = telephone.replace(/\D/g, "");
    const [parIp, parTel, global] = await Promise.all([
      depasse(`rdv:ip:${empreinte(ip)}`, 5, 3600),
      depasse(`rdv:tel:${empreinte(chiffres)}`, 3, 86400),
      depasse("rdv:global", 60, 3600),
    ]);
    return parIp || parTel || global;
  } catch (e) {
    // Panne du stockage : on laisse passer plutôt que de bloquer les vrais patients
    console.error(e);
    return false;
  }
}

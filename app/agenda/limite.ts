// Limitation du nombre d'essais (connexion, réservation en ligne), comptés dans le stockage Redis du cabinet.
// Si le stockage est absent ou en panne, on laisse passer (et on le signale dans les journaux) plutôt que
// de bloquer le cabinet.

import { commande, stockageConfigure } from "./stockage";

// Ajoute un essai à la clé et renvoie le total dans la fenêtre (en secondes). null si le stockage est indisponible.
export async function compter(cle: string, fenetre: number): Promise<number | null> {
  if (!stockageConfigure()) return null;
  try {
    const n = await commande<number>("INCR", `limite:${cle}`);
    if (n === 1) await commande("EXPIRE", `limite:${cle}`, String(fenetre));
    return n;
  } catch (erreur) {
    console.error("Limitation indisponible", erreur);
    return null;
  }
}

// Total déjà atteint, sans ajouter d'essai
export async function lire(cle: string): Promise<number> {
  if (!stockageConfigure()) return 0;
  try {
    return Number(await commande<string | null>("GET", `limite:${cle}`)) || 0;
  } catch (erreur) {
    console.error("Limitation indisponible", erreur);
    return 0;
  }
}

// Retire un essai (par exemple après une connexion réussie : seuls les échecs doivent compter)
export async function retirerUn(cle: string) {
  if (!stockageConfigure()) return;
  await commande("DECR", `limite:${cle}`).catch(console.error);
}

export async function effacer(cle: string) {
  if (!stockageConfigure()) return;
  await commande("DEL", `limite:${cle}`).catch(console.error);
}

// Marque une valeur comme déjà utilisée ; false si elle l'était (anti-rejeu)
export async function reserverUneFois(cle: string, fenetre: number): Promise<boolean> {
  if (!stockageConfigure()) return true;
  try {
    return (await commande<string | null>("SET", `limite:${cle}`, "1", "EX", String(fenetre), "NX")) === "OK";
  } catch (erreur) {
    console.error("Limitation indisponible", erreur);
    return true;
  }
}

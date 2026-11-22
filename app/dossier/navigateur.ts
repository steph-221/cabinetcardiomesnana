// Navigateur sans fenêtre (Chromium piloté par Playwright) pour copier les pages des sites suivis telles qu'elles
// s'affichent, après exécution de leurs scripts.
// - Sur Vercel : Chromium adapté aux fonctions serverless (@sparticuz/chromium), décompressé au premier lancement.
// - Sur un ordinateur de développement : le Chromium de Playwright (`npx playwright install chromium`), ou celui
//   indiqué par CHROMIUM_PATH.

import type { Browser } from "playwright-core";

// Le navigateur n'a pas pu démarrer : ce n'est la faute d'aucune adresse, le lot s'arrête et la file reste intacte
export class ErreurNavigateur extends Error {}

// Chromium est décompressé une seule fois par instance, même si plusieurs appels arrivent en même temps
let cheminChromium: Promise<string> | null = null;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

// « ETXTBSY » : le fichier est encore en cours d'écriture par un autre appel de la même instance, on réessaie
const fichierOccupe = (e: unknown) => e instanceof Error && /ETXTBSY|EBUSY/.test(e.message);

export async function ouvrirNavigateur(): Promise<Browser> {
  try {
    const { chromium } = await import("playwright-core");
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const { default: Chromium } = await import("@sparticuz/chromium");
      cheminChromium ??= Chromium.executablePath().catch((e) => {
        cheminChromium = null;
        throw e;
      });
      const executablePath = await cheminChromium;
      for (let essai = 1; ; essai++) {
        try {
          return await chromium.launch({ args: Chromium.args, executablePath, headless: true });
        } catch (e) {
          if (!fichierOccupe(e) || essai >= 6) throw e;
          await attendre(1500);
        }
      }
    }
    return await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  } catch (erreur) {
    console.error("Lancement du navigateur impossible", erreur);
    const detail = erreur instanceof Error ? erreur.message.split("\n").find((l) => l.trim()) : "";
    throw new ErreurNavigateur(`Le navigateur de copie n'a pas pu démarrer : ${(detail ?? "").trim().slice(0, 220)}`);
  }
}

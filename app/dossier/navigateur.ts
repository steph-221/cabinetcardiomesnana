// Navigateur sans fenêtre (Chromium piloté par Playwright) pour copier les pages des sites suivis telles qu'elles
// s'affichent, après exécution de leurs scripts.
// - Sur Vercel : Chromium adapté aux fonctions serverless (@sparticuz/chromium), décompressé au premier lancement.
// - Sur un ordinateur de développement : le Chromium de Playwright (`npx playwright install chromium`), ou celui
//   indiqué par CHROMIUM_PATH.

import type { Browser } from "playwright-core";

export async function ouvrirNavigateur(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const { default: Chromium } = await import("@sparticuz/chromium");
    return chromium.launch({ args: Chromium.args, executablePath: await Chromium.executablePath(), headless: true });
  }
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
}

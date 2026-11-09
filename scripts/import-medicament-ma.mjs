// Importe la base publique medicament.ma (fiches du sitemap) vers app/dossier/medicaments-ma.json
// Usage : node scripts/import-medicament-ma.mjs [--reprendre]
// Lecture douce : 6 requêtes en parallèle, nouvelle tentative en cas d'erreur, reprise possible.

import { readFile, writeFile } from "node:fs/promises";

const SORTIE = new URL("../app/dossier/medicaments-ma.json", import.meta.url);
const BRUT = process.env.MEDICAMENT_MA_CACHE ?? "/tmp/medicament-ma-brut.json";
const HOTE = "https://medicament.ma";
const PARALLELE = 6;

const get = async (url, essais = 4) => {
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "cabinet-ordonnance-import" } });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  return null;
};

const texte = (h) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

function lireFiche(html, url) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1) return null;
  const champ = (nom) => {
    const m = html.match(new RegExp(`detail-header">\\s*${nom}\\s*</div>\\s*<div class="detail-content">([\\s\\S]*?)</div>`, "i"));
    return m ? texte(m[1]) : "";
  };
  return {
    nom: texte(h1[1]),
    url,
    generique: /G[ée]n[ée]rique/.test(texte((html.match(/<h1[\s\S]{0,600}/) ?? [""])[0])),
    presentation: champ("Présentation"),
    dosage: champ("Dosage"),
    labo: champ("Distributeur ou fabriquant"),
    dci: champ("Composition"),
    classe: champ("Classe thérapeutique"),
    statut: champ("Statut"),
    ppv: champ("PPV"),
    tableau: champ("Tableau"),
  };
}

async function main() {
  const urls = [];
  for (let i = 1; i <= 8; i++) {
    const xml = await get(`${HOTE}/wp-sitemap-posts-medicament-${i}.xml`);
    if (!xml) break;
    urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  }
  console.log(`${urls.length} fiches dans le sitemap`);

  let faits = {};
  if (process.argv.includes("--reprendre")) {
    try {
      faits = JSON.parse(await readFile(BRUT, "utf8"));
    } catch {}
  }
  const restantes = urls.filter((u) => !(u in faits));
  let n = 0;
  const travailleur = async () => {
    while (restantes.length) {
      const url = restantes.pop();
      const html = await get(url);
      faits[url] = html ? lireFiche(html, url) : null;
      if (++n % 200 === 0) {
        console.log(`${n}/${n + restantes.length}`);
        await writeFile(BRUT, JSON.stringify(faits));
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLELE }, travailleur));
  await writeFile(BRUT, JSON.stringify(faits));

  const liste = Object.values(faits)
    .filter(Boolean)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  await writeFile(SORTIE, JSON.stringify(liste));
  console.log(`${liste.length} médicaments écrits`);
}

await main();

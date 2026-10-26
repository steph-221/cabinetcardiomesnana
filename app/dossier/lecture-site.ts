// Lecture de la liste des publications d'un site suivi (page de liste, comme celle des recommandations de l'ESC,
// ou flux RSS / Atom d'une revue). Seuls les titres, les liens et les dates sont relevés : le contenu des
// publications n'est ni téléchargé ni conservé.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type PublicationLue = { titre: string; url: string; annee: number | null; publieLe: Date | null };

const TAILLE_MAX = 3_000_000;
const REDIRECTIONS_MAX = 4;
const PUBLICATIONS_MAX = 300;

// Adresses internes (réseau local, machine elle-même) : refusées, le serveur ne doit lire que des sites publics
function adresseInterne(ip: string) {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    if (v6.startsWith("::ffff:")) return adresseInterne(v6.slice(7));
    return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b < 128) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b < 32) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function verifierAdresse(url: URL) {
  if (url.protocol !== "https:") throw new Error("Le site doit être en https.");
  const hote = url.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(hote) ? [hote] : (await lookup(hote, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(adresseInterne)) throw new Error("Adresse non autorisée.");
}

// Télécharge la page de liste (ou le flux), en suivant au plus quelques redirections, toutes vérifiées
async function telecharger(adresse: string) {
  let url = new URL(adresse);
  for (let i = 0; i <= REDIRECTIONS_MAX; i++) {
    await verifierAdresse(url);
    const reponse = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; cabinet-bibliotheque/1.0)",
        accept:
          "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5",
      },
      cache: "no-store",
    });
    const suite = reponse.headers.get("location");
    if (reponse.status >= 300 && reponse.status < 400 && suite) {
      url = new URL(suite, url);
      continue;
    }
    if (!reponse.ok) throw new Error(`Le site a répondu ${reponse.status}.`);
    const taille = Number(reponse.headers.get("content-length") ?? 0);
    if (taille > TAILLE_MAX) throw new Error("La page est trop volumineuse.");
    const texte = await reponse.text();
    return { texte: texte.slice(0, TAILLE_MAX), url: url.toString() };
  }
  throw new Error("Trop de redirections.");
}

const entites: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decoderEntites(texte: string) {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : tout;
    }
    return entites[code.toLowerCase()] ?? tout;
  });
}

const nettoyer = (html: string) =>
  decoderEntites(html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const anneeDe = (titre: string) => {
  const m = titre.match(/\b(19[5-9]\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
};

const attribut = (attributs: string, nom: string) => {
  const m = attributs.match(new RegExp(`\\b${nom}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return m ? decoderEntites(m[1] ?? m[2]).trim() : "";
};

// Textes de lien sans information (« Read », « En savoir plus »…), remplacés par un meilleur titre si possible
const generique =
  /^(read|read more|more|lire|lire la suite|en savoir plus|voir|view|download|télécharger|pdf|details|détails)$/i;
const prefixeAction = /^(read|lire|view|voir|download|télécharger)\s+/i;

// Titre tiré de l'adresse quand la page n'en donne pas : « …/atrial-fibrillation/ » → « Atrial fibrillation »
function titreDeAdresse(url: string) {
  const dernier = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  const mots = decodeURIComponent(dernier)
    .replace(/\.\w+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return mots ? mots[0].toUpperCase() + mots.slice(1) : url;
}

// Liens d'une page HTML qui commencent par le préfixe donné (par défaut, l'adresse de la page de liste)
export function lirePageListe(html: string, adressePage: string, prefixe: string): PublicationLue[] {
  const base = html.match(/<base\b[^>]*href\s*=\s*["']([^"']+)["']/i)?.[1];
  const racine = new URL(base ?? adressePage, adressePage);
  const debut = new URL(prefixe || adressePage, adressePage);
  debut.hash = "";
  debut.search = "";
  const page = new URL(adressePage);
  page.hash = "";
  const titres = new Map<string, string>();

  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribut(m[1], "href");
    if (!href || /^(javascript|mailto|tel):/i.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href, racine);
    } catch {
      continue;
    }
    url.hash = "";
    const adresse = url.toString();
    if (url.protocol !== "https:" || !adresse.startsWith(debut.toString()) || adresse === page.toString()) continue;
    if (adresse === debut.toString()) continue;
    const candidats = [attribut(m[1], "aria-label").replace(prefixeAction, ""), attribut(m[1], "title"), nettoyer(m[2])]
      .map((t) => t.replace(/\s+/g, " ").trim())
      .filter((t) => t && !generique.test(t));
    const meilleur = candidats.sort((x, y) => y.length - x.length)[0] ?? "";
    const actuel = titres.get(adresse);
    if (actuel === undefined || meilleur.length > actuel.length) titres.set(adresse, meilleur);
  }

  return [...titres].slice(0, PUBLICATIONS_MAX).map(([url, titre]) => {
    const propre = (titre || titreDeAdresse(url)).slice(0, 300);
    return { titre: propre, url, annee: anneeDe(propre), publieLe: null };
  });
}

const balise = (bloc: string, nom: string) => {
  const m = bloc.match(new RegExp(`<${nom}\\b[^>]*>([\\s\\S]*?)</${nom}>`, "i"));
  return m ? nettoyer(m[1]) : "";
};

const dateValide = (texte: string) => {
  const d = texte ? new Date(texte) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

export const estFlux = (texte: string) =>
  /^\s*(?:﻿)?(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)\b/i.test(texte);

// Articles d'un flux RSS ou Atom
export function lireFlux(xml: string, adresseFlux: string): PublicationLue[] {
  const blocs = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  const lues: PublicationLue[] = [];
  const vues = new Set<string>();
  for (const bloc of blocs) {
    const titre = balise(bloc, "title").slice(0, 300);
    const liens = [...bloc.matchAll(/<link\b([^>]*?)\/?>(?:([\s\S]*?)<\/link>)?/gi)];
    const alternatif =
      liens.find((l) => /\bhref\s*=/.test(l[1]) && !/\brel\s*=\s*["'](?!alternate)/i.test(l[1])) ?? liens[0];
    const brut = alternatif ? attribut(alternatif[1], "href") || nettoyer(alternatif[2] ?? "") : balise(bloc, "guid");
    let url: string;
    try {
      url = new URL(brut, adresseFlux).toString();
    } catch {
      continue;
    }
    if (!titre || !url.startsWith("https://") || vues.has(url)) continue;
    vues.add(url);
    const publieLe = dateValide(
      balise(bloc, "pubDate") || balise(bloc, "published") || balise(bloc, "dc:date") || balise(bloc, "updated"),
    );
    lues.push({ titre, url, annee: anneeDe(titre) ?? publieLe?.getUTCFullYear() ?? null, publieLe });
    if (lues.length >= PUBLICATIONS_MAX) break;
  }
  return lues;
}

export async function lireSite(adresse: string, prefixe: string): Promise<PublicationLue[]> {
  const { texte, url } = await telecharger(adresse);
  return estFlux(texte) ? lireFlux(texte, url) : lirePageListe(texte, url, prefixe);
}

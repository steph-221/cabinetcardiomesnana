// Copie privée des pages et des fichiers d'un site suivi, pour la bibliothèque du médecin (jamais republiée).
// - Une page est ouverte dans un vrai navigateur (Playwright), après exécution de ses scripts, puis enregistrée en
//   un seul fichier HTML autonome : feuilles de style, images et polices y sont incluses, les scripts sont retirés.
//   Son texte est gardé à part pour la bibliothèque.
// - Un fichier (PDF, diaporama, document Word…) est téléchargé tel quel.
// Un site qui bloque les robots (page « Just a moment… » de Cloudflare, par exemple) n'est pas contourné : la copie
// est signalée « bloquée », et le médecin ajoute le document lui-même.
// Aucun accès à la base ni à Google Drive ici.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Browser } from "playwright-core";
import { adresseInterne, verifierAdresse } from "./lecture-site";

export type Lien = { url: string; texte: string };

export type PageCopiee = { genre: "page"; url: string; titre: string; html: string; texte: string; liens: Lien[] };
export type FichierCopie = {
  genre: "fichier";
  url: string;
  titre: string;
  nom: string;
  mime: string;
  donnees: Uint8Array;
};
export type Copie = PageCopiee | FichierCopie;

// Le site refuse les visites automatiques : pas de contournement
export class CopieBloquee extends Error {
  constructor() {
    super("Le site bloque les copies automatiques : ouvrez la page et ajoutez le document à la main.");
  }
}

export const TAILLE_FICHIER_MAX = 80 * 1024 * 1024;
const TAILLE_RESSOURCE_MAX = 1_500_000;
// Total des images et polices incluses dans une page : la copie reste ainsi sous 4 Mo, affichable par le site
const BUDGET_INCLUS = 1_800_000;
const TEXTE_MAX = 3_000_000;
const DELAI_PAGE = 30_000;

// --- Reconnaître un fichier ---

const EXTENSIONS = /\.(pdf|docx?|pptx?|xlsx?|odt|odp|ods|rtf|epub|csv)$/i;

// Lien vers un document à copier : extension connue, ou chemin de téléchargement (« …/download/… », « …/pdf/… »)
export function estLienDocument(adresse: string) {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return EXTENSIONS.test(url.pathname) || /\/(download|downloads|pdf|article-pdf|static-file)\//i.test(url.pathname);
}

const MIMES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/rtf": "rtf",
  "application/epub+zip": "epub",
  "text/csv": "csv",
};

const MIMES_PAR_EXTENSION = Object.fromEntries(Object.entries(MIMES).map(([m, e]) => [e, m]));

// Nom du fichier : celui annoncé par le site, sinon la fin de l'adresse, avec la bonne extension
function nomFichier(disposition: string | null, url: URL, mime: string) {
  const etendu = disposition?.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/)?.[1];
  const simple = disposition?.match(/filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/);
  let nom = "";
  try {
    nom = etendu ? decodeURIComponent(etendu) : (simple?.[1] ?? simple?.[2] ?? "");
  } catch {
    nom = simple?.[1] ?? simple?.[2] ?? "";
  }
  if (!nom) nom = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "") || url.hostname;
  nom = nom
    .replace(/[\u0000-\u001f/\\]/g, " ")
    .trim()
    .slice(0, 180);
  const extension = MIMES[mime];
  if (extension && !nom.toLowerCase().endsWith(`.${extension}`)) nom += `.${extension}`;
  return nom;
}

// Page de protection anti-robots (Cloudflare, Akamai…) au lieu du contenu
function estProtection(statut: number, entetes: Record<string, string>, titre = "") {
  if (entetes["cf-mitigated"] === "challenge") return true;
  if (/^(just a moment|attention required|un instant|access denied|checking your browser)/i.test(titre.trim())) {
    return statut === 403 || statut === 429 || statut === 503 || /just a moment|checking/i.test(titre);
  }
  return (statut === 403 || statut === 429) && /cloudflare|akamai/i.test(entetes["server"] ?? "");
}

async function lireAvecLimite(reponse: Response, limite: number) {
  const lecteur = reponse.body?.getReader();
  if (!lecteur) return new Uint8Array();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > limite) {
      await lecteur.cancel();
      throw new Error("Fichier trop volumineux (plus de 80 Mo).");
    }
    morceaux.push(value);
  }
  const donnees = new Uint8Array(total);
  let i = 0;
  for (const m of morceaux) {
    donnees.set(m, i);
    i += m.length;
  }
  return donnees;
}

// Télécharge un document. Renvoie null si l'adresse donne en fait une page HTML (à ouvrir dans le navigateur).
export async function telechargerFichier(adresse: string): Promise<FichierCopie | null> {
  let url = new URL(adresse);
  for (let i = 0; i <= 5; i++) {
    await verifierAdresse(url);
    const reponse = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
      headers: { accept: "*/*", "user-agent": "Mozilla/5.0 (compatible; cabinet-bibliotheque/1.0)" },
      cache: "no-store",
    });
    const suite = reponse.headers.get("location");
    if (reponse.status >= 300 && reponse.status < 400 && suite) {
      await reponse.body?.cancel();
      url = new URL(suite, url);
      continue;
    }
    const entetes = Object.fromEntries(reponse.headers);
    const mime = (entetes["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (estProtection(reponse.status, entetes)) {
      await reponse.body?.cancel();
      throw new CopieBloquee();
    }
    if (!reponse.ok) {
      await reponse.body?.cancel();
      throw new Error(`Le site a répondu ${reponse.status}.`);
    }
    if (mime === "text/html" || mime === "application/xhtml+xml") {
      await reponse.body?.cancel();
      return null;
    }
    if (Number(entetes["content-length"] ?? 0) > TAILLE_FICHIER_MAX) {
      await reponse.body?.cancel();
      throw new Error("Fichier trop volumineux (plus de 80 Mo).");
    }
    const donnees = await lireAvecLimite(reponse, TAILLE_FICHIER_MAX);
    const nom = nomFichier(entetes["content-disposition"] ?? null, url, mime);
    const extension = nom.split(".").pop()?.toLowerCase() ?? "";
    const type =
      mime && mime !== "application/octet-stream"
        ? mime
        : (MIMES_PAR_EXTENSION[extension] ?? "application/octet-stream");
    return { genre: "fichier", url: adresse, titre: nom.replace(/\.\w{2,5}$/, ""), nom, mime: type, donnees };
  }
  throw new Error("Trop de redirections.");
}

// --- Copier une page ---

// Les requêtes de la page vers le réseau local ou la machine elle-même sont refusées
function gardien() {
  const hotes = new Map<string, Promise<boolean>>();
  return (adresse: string) => {
    let url: URL;
    try {
      url = new URL(adresse);
    } catch {
      return Promise.resolve(false);
    }
    if (url.protocol === "data:" || url.protocol === "blob:") return Promise.resolve(true);
    if (url.protocol !== "https:" && url.protocol !== "http:") return Promise.resolve(false);
    const hote = url.hostname.replace(/^\[|\]$/g, "");
    let verdict = hotes.get(hote);
    if (!verdict) {
      verdict = (
        isIP(hote) ? Promise.resolve([hote]) : lookup(hote, { all: true }).then((r) => r.map((x) => x.address))
      )
        .then((ips) => ips.length > 0 && !ips.some(adresseInterne))
        .catch(() => false);
      hotes.set(hote, verdict);
    }
    return verdict;
  };
}

const resoudre = (cible: string, base: string) => {
  try {
    return new URL(cible, base).href;
  } catch {
    return null;
  }
};

const MIMES_RESSOURCES: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

type Ressource = { mime: string; corps: Buffer };

// Feuilles de style et images de la page, réécrites avec leurs ressources incluses (« data: »), dans la limite du
// budget ; au-delà, elles gardent leur adresse d'origine.
function preparerRessources(ressources: Map<string, Ressource>, feuilles: string[], images: string[]) {
  let budget = BUDGET_INCLUS;
  const incluses = new Map<string, string | null>();
  const enDonnees = (url: string) => {
    if (!incluses.has(url)) {
      const r = ressources.get(url);
      let valeur: string | null = null;
      if (r && r.corps.length <= budget) {
        budget -= r.corps.length;
        const extension = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
        const mime = r.mime || MIMES_RESSOURCES[extension] || "application/octet-stream";
        valeur = `data:${mime};base64,${r.corps.toString("base64")}`;
      }
      incluses.set(url, valeur);
    }
    return incluses.get(url) ?? null;
  };

  const traiterCss = (texte: string, base: string, niveau: number): string =>
    texte
      .replace(
        /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?([^;]*);/gi,
        (tout, cible: string, medias: string) => {
          const adresse = resoudre(cible, base);
          const r = adresse ? ressources.get(adresse) : undefined;
          if (!adresse || !r || niveau > 2) return adresse ? `@import url("${adresse}")${medias};` : tout;
          const interne = traiterCss(r.corps.toString("utf8"), adresse, niveau + 1);
          return medias.trim() ? `@media ${medias.trim()} {\n${interne}\n}` : interne;
        },
      )
      .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (tout, _guillemet, cible: string) => {
        if (/^(data|blob):/i.test(cible.trim()) || cible.trim().startsWith("#")) return tout;
        const adresse = resoudre(cible.trim(), base);
        return adresse ? `url("${enDonnees(adresse) ?? adresse}")` : tout;
      });

  const css: Record<string, string> = {};
  for (const href of feuilles) {
    const r = ressources.get(href);
    if (r && css[href] === undefined) css[href] = traiterCss(r.corps.toString("utf8"), href, 0);
  }
  const donneesImages: Record<string, string> = {};
  for (const src of images) {
    const valeur = enDonnees(src);
    if (valeur) donneesImages[src] = valeur;
  }
  return { css, images: donneesImages };
}

// Bandeaux de cookies les plus courants, retirés de la copie
const BANDEAUX = [
  "#onetrust-consent-sdk",
  "#CybotCookiebotDialog",
  "#didomi-host",
  "#tarteaucitronRoot",
  "#axeptio_overlay",
  "#usercentrics-root",
  "#cookie-law-info-bar",
  ".cc-window",
  "#cookie-banner",
  ".cookie-banner",
  "#cookieConsent",
].join(", ");

// --- Scripts exécutés dans la page ---
// Écrits en JavaScript simple, dans des chaînes : ils sont envoyés tels quels au navigateur, sans passer par la
// compilation du site (qui pourrait y ajouter des fonctions auxiliaires inconnues de la page).

const executer = (script: string, argument: unknown) => `(${script})(${JSON.stringify(argument)})`;

// Fait défiler la page pour charger les images « paresseuses »
const DEFILER = String.raw`async function () {
  var hauteur = Math.min(document.body ? document.body.scrollHeight : 0, 30000);
  for (var y = 0; y < hauteur; y += 700) {
    window.scrollTo(0, y);
    await new Promise(function (r) { setTimeout(r, 80); });
  }
  window.scrollTo(0, 0);
}`;

type Infos = { titre: string; texte: string; liens: Lien[]; feuilles: string[]; images: string[] };

// Titre, texte principal, liens, feuilles de style et images de la page (après retrait des bandeaux de cookies)
const INFOS = String.raw`function (bandeaux) {
  document.querySelectorAll(bandeaux).forEach(function (e) { e.remove(); });
  var zone = document.querySelector("main, article, [role=main]");
  var principal = zone ? zone.innerText : "";
  var images = [];
  document.querySelectorAll("img").forEach(function (img) {
    var src = img.currentSrc || img.src;
    if (src && src.indexOf("data:") !== 0 && images.indexOf(src) < 0) images.push(src);
  });
  return {
    titre: document.title,
    texte: principal.trim().length >= 300 ? principal : (document.body ? document.body.innerText : ""),
    liens: Array.from(document.querySelectorAll("a[href]")).map(function (a) {
      var texte = a.innerText || a.getAttribute("aria-label") || a.getAttribute("title") || "";
      return { url: a.href, texte: texte.replace(/\s+/g, " ").trim().slice(0, 200) };
    }),
    feuilles: Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]')).map(function (l) { return l.href; }),
    images: images
  };
}`;

// Transforme la page en un seul fichier autonome : styles et images inclus, scripts retirés, liens absolus,
// bandeau « copie privée » en haut. Renvoie le HTML complet.
const REECRIRE = String.raw`function (donnees) {
  var css = donnees.css, images = donnees.images, origine = donnees.origine;
  function absolue(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }
  function remplacerUrls(texte) {
    return texte.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, function (tout, g, cible) {
      cible = cible.trim();
      if (/^(data|blob):/i.test(cible)) return tout;
      var a = absolue(cible);
      return 'url("' + (images[a] || a) + '")';
    });
  }

  // Styles injectés par les scripts (CSS-in-JS) : absents du HTML, ils sont recopiés depuis le navigateur
  document.querySelectorAll("style").forEach(function (s) {
    if ((s.textContent || "").trim() || !s.sheet) return;
    try { s.textContent = Array.from(s.sheet.cssRules).map(function (r) { return r.cssText; }).join("\n"); } catch (e) {}
  });
  document.querySelectorAll("style").forEach(function (s) {
    if ((s.textContent || "").indexOf("url(") >= 0) s.textContent = remplacerUrls(s.textContent);
  });
  document.querySelectorAll('link[rel~="stylesheet"]').forEach(function (l) {
    var href = l.href;
    if (css[href] === undefined) { l.setAttribute("href", href); return; }
    var style = document.createElement("style");
    var media = l.getAttribute("media");
    if (media) style.setAttribute("media", media);
    style.textContent = css[href];
    l.replaceWith(style);
  });

  document.querySelectorAll(
    "script, noscript, object, embed, applet, base, meta[http-equiv], meta[charset], " +
    "link[rel~=preload], link[rel~=modulepreload], link[rel~=prefetch], link[rel~=preconnect], " +
    "link[rel~=dns-prefetch], link[rel~=manifest], link[rel~=serviceworker]"
  ).forEach(function (e) { e.remove(); });
  document.querySelectorAll("iframe, frame").forEach(function (f) {
    var src = f.getAttribute("src");
    if (!src || /^(about|javascript):/i.test(src)) { f.remove(); return; }
    var lien = document.createElement("a");
    lien.href = absolue(src);
    lien.textContent = "[Contenu intégré : " + lien.href + "]";
    f.replaceWith(lien);
  });
  document.querySelectorAll("picture source").forEach(function (s) { s.remove(); });

  document.querySelectorAll("*").forEach(function (e) {
    Array.from(e.attributes).forEach(function (a) { if (/^on/i.test(a.name)) e.removeAttribute(a.name); });
    var style = e.getAttribute("style");
    if (style && style.indexOf("url(") >= 0) e.setAttribute("style", remplacerUrls(style));
  });
  document.querySelectorAll("img").forEach(function (img) {
    var src = img.currentSrc || img.src;
    if (src) img.setAttribute("src", images[src] || src);
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.removeAttribute("loading");
  });
  document.querySelectorAll("a[href]").forEach(function (a) {
    var href = a.getAttribute("href") || "";
    if (/^\s*javascript:/i.test(href)) a.removeAttribute("href");
    else if (href.charAt(0) !== "#") a.setAttribute("href", a.href);
    a.setAttribute("rel", "noopener noreferrer");
  });
  document.querySelectorAll("form[action]").forEach(function (f) { f.setAttribute("action", f.action); });

  var tete = document.head || document.documentElement.insertBefore(document.createElement("head"), document.body);
  var jeu = document.createElement("meta");
  jeu.setAttribute("charset", "utf-8");
  var base = document.createElement("base");
  base.href = origine;
  var referent = document.createElement("meta");
  referent.name = "referrer";
  referent.content = "no-referrer";
  var robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex, nofollow";
  tete.prepend(jeu, base, referent, robots);

  var bandeau = document.createElement("div");
  bandeau.setAttribute("style", "all:initial;display:block;padding:8px 12px;background:#fef3c7;color:#78350f;" +
    "font:13px/1.4 system-ui,sans-serif;border-bottom:1px solid #f59e0b");
  bandeau.append(donnees.mention + " ");
  var lien = document.createElement("a");
  lien.href = origine;
  lien.textContent = origine;
  lien.setAttribute("style", "color:#92400e;text-decoration:underline;word-break:break-all");
  bandeau.append(lien);
  if (document.body) document.body.prepend(bandeau);

  return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
}`;

export async function capturerPage(navigateur: Browser, adresse: string): Promise<Copie> {
  await verifierAdresse(new URL(adresse));
  const autorise = gardien();
  const contexte = await navigateur.newContext({
    locale: "fr-FR",
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
    acceptDownloads: false,
  });
  try {
    await contexte.route("**/*", async (route) => {
      const requete = route.request();
      const inutile = ["media", "websocket", "eventsource", "manifest", "texttrack"].includes(requete.resourceType());
      if (inutile || !(await autorise(requete.url()))) return route.abort();
      return route.continue();
    });

    // Feuilles de style, images et polices reçues par la page, pour les inclure dans la copie
    const ressources = new Map<string, Ressource>();
    const lectures: Promise<void>[] = [];
    const page = await contexte.newPage();
    page.on("response", (r) => {
      const type = r.request().resourceType();
      if (!["stylesheet", "image", "font"].includes(type) || r.status() !== 200) return;
      const limite = type === "stylesheet" ? 2 * TAILLE_RESSOURCE_MAX : TAILLE_RESSOURCE_MAX;
      lectures.push(
        r.body().then(
          (corps) => {
            if (corps.length <= limite) {
              ressources.set(r.url(), { mime: (r.headers()["content-type"] ?? "").split(";")[0].trim(), corps });
            }
          },
          () => {},
        ),
      );
    });

    let reponse;
    try {
      reponse = await page.goto(adresse, { waitUntil: "domcontentloaded", timeout: DELAI_PAGE });
    } catch (erreur) {
      // L'adresse mène à un fichier : le navigateur sans fenêtre le télécharge au lieu de l'afficher
      if (erreur instanceof Error && /Download is starting|ERR_ABORTED/.test(erreur.message)) {
        const fichier = await telechargerFichier(adresse);
        if (fichier) return fichier;
      }
      if (erreur instanceof Error && /Timeout/i.test(erreur.message))
        throw new Error("La page met trop de temps à s'ouvrir.");
      throw erreur;
    }
    if (!reponse) throw new Error("La page n'a pas répondu.");
    const entetes = reponse.headers();
    const mime = (entetes["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (mime && !/html/.test(mime)) {
      const fichier = await telechargerFichier(adresse);
      if (fichier) return fichier;
    }
    await verifierAdresse(new URL(page.url()));
    if (estProtection(reponse.status(), entetes, await page.title().catch(() => ""))) throw new CopieBloquee();
    if (reponse.status() >= 400) throw new Error(`Le site a répondu ${reponse.status()}.`);

    // Laisse la page finir de se construire, et fait défiler pour charger les images « paresseuses »
    await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    await page.evaluate(executer(DEFILER, null)).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
    for (let n = 0; n < lectures.length; ) {
      const lot = lectures.slice(n);
      n = lectures.length;
      await Promise.allSettled(lot);
    }
    // Une dernière vérification : certaines protections n'affichent leur page qu'après les scripts
    if (estProtection(200, {}, await page.title().catch(() => ""))) throw new CopieBloquee();

    const infos = (await page.evaluate(executer(INFOS, BANDEAUX))) as Infos;

    const { css, images } = preparerRessources(ressources, infos.feuilles, infos.images);
    const origine = page.url();
    const mention = `Copie privée du ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" })}, pour usage personnel du cabinet — page d'origine :`;

    const html = (await page.evaluate(executer(REECRIRE, { css, images, origine, mention }))) as string;

    const texte = infos.texte
      .replace(/[ \t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, TEXTE_MAX);
    const titre = infos.titre.replace(/\s+/g, " ").trim().slice(0, 300) || new URL(origine).hostname;
    const liens = infos.liens.filter((l) => /^https?:/i.test(l.url));
    return { genre: "page", url: origine, titre, html, texte, liens };
  } finally {
    await contexte.close().catch(() => {});
  }
}

// Copie une adresse : document téléchargé tel quel, ou page ouverte dans le navigateur (lancé seulement si besoin)
export async function copierAdresse(adresse: string, navigateur: () => Promise<Browser>): Promise<Copie> {
  if (estLienDocument(adresse)) {
    const fichier = await telechargerFichier(adresse);
    if (fichier) return fichier;
  }
  return capturerPage(await navigateur(), adresse);
}

// Documents liés depuis une page (PDF, diaporamas…), sans doublon, dans la limite donnée
export function documentsLies(liens: Lien[], limite = 12) {
  const vus = new Map<string, string>();
  for (const { url, texte } of liens) {
    if (!estLienDocument(url)) continue;
    const propre = new URL(url);
    propre.hash = "";
    const cle = propre.toString();
    if (!vus.has(cle) || (texte.length > (vus.get(cle) ?? "").length && !/^(download|télécharger)/i.test(texte))) {
      vus.set(cle, texte);
    }
    if (vus.size >= limite) break;
  }
  return [...vus].map(([url, texte]) => ({ url, texte }));
}

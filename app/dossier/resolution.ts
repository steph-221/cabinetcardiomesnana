// Identification d'une publication par son DOI : l'adresse d'une recommandation de l'ESC renvoie vers l'éditeur
// (Oxford University Press), qui refuse les robots. Le DOI, lui, se lit sur la page de l'ESC, dans la première page
// d'un PDF ou dans un lien, et ouvre les métadonnées publiques (Crossref) et, quand le texte est en accès libre,
// le PDF (Europe PMC). Seules les fonctions de lecture de texte sont pures ; l'accès réseau est tolérant aux pannes.

export type Metadonnees = {
  titre: string;
  annee: number | null;
  revue: string;
  resume: string;
  // PDF en accès libre, quand il existe
  pdf: string;
  libre: boolean;
};

// 10.1093/eurheartj/ehae176 : préfixe, puis suffixe jusqu'au premier espace ou guillemet
const MOTIF_DOI = /\b(10\.\d{4,9}\/[^\s"'<>]+)/i;

const nettoyerDoi = (brut: string) =>
  decodeURIComponent(brut.replace(/&amp;/g, "&"))
    .replace(/[)\].,;:]+$/g, "")
    .toLowerCase();

export function extraireDoi(texte: string): string | null {
  const m = MOTIF_DOI.exec(texte);
  if (!m) return null;
  try {
    return nettoyerDoi(m[1]);
  } catch {
    return nettoyerDoi(m[1].replace(/%(?![0-9a-f]{2})/gi, ""));
  }
}

const meta = (html: string, nom: string) => {
  for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const nomMeta = /\b(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1];
    if (nomMeta?.toLowerCase() === nom) return /\bcontent\s*=\s*["']([^"']*)["']/i.exec(m[1])?.[1] ?? "";
  }
  return "";
};

// DOI d'une page d'éditeur ou de société savante : balise de citation, sinon lien « article-lookup/doi/… » ou doi.org
export function doiDePage(html: string): string | null {
  for (const nom of ["citation_doi", "dc.identifier", "prism.doi", "bepress_citation_doi"]) {
    const doi = extraireDoi(meta(html, nom));
    if (doi) return doi;
  }
  const lien =
    /href\s*=\s*["'][^"']*(?:article-lookup\/doi|doi\.org)\/(10\.\d{4,9}\/[^"'#?]+)/i.exec(html)?.[1] ??
    /href\s*=\s*["'][^"']*\/doi\/(?:abs\/|full\/|pdf\/)?(10\.\d{4,9}\/[^"'#?]+)/i.exec(html)?.[1];
  return lien ? extraireDoi(lien) : null;
}

// Lien direct vers le PDF annoncé par la page (balise de citation)
export function pdfDePage(html: string, base: string): string {
  const brut = meta(html, "citation_pdf_url");
  if (!brut) return "";
  try {
    const url = new URL(brut, base);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

// DOI d'un PDF : sur la première page, souvent « https://doi.org/10.1093/… » ou « doi:10.… »
export function doiDePdf(textePremierePage: string): string | null {
  const m = /(?:doi(?:\.org\/|:\s*)|DOI\s*)?(10\.\d{4,9}\/[^\s"'<>]+)/i.exec(textePremierePage.replace(/([/.-])[ \t]*\n\s*/g, "$1").replace(/\s*\n\s*/g, " "));
  return m ? extraireDoi(m[1]) : null;
}

export const lienDoi = (doi: string) => `https://doi.org/${doi}`;

// --- Lecture des services publics (tolérante : renvoie null au moindre échec) ---

type Telechargeur = (url: string) => Promise<string>;

const annee = (v: unknown): number | null => {
  const n = Array.isArray(v) ? Number((v as unknown[][])[0]?.[0]) : NaN;
  return Number.isInteger(n) && n > 1900 && n < 2100 ? n : null;
};

// Crossref : titre, année et revue de la publication
export async function metadonneesCrossref(doi: string, lire: Telechargeur): Promise<Pick<Metadonnees, "titre" | "annee" | "revue"> | null> {
  try {
    const r = JSON.parse(await lire(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)) as {
      message?: { title?: string[]; "container-title"?: string[]; issued?: { "date-parts"?: unknown[] }; published?: { "date-parts"?: unknown[] } };
    };
    const m = r.message;
    const titre = m?.title?.[0]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!titre) return null;
    return { titre, annee: annee(m?.issued?.["date-parts"] ?? m?.published?.["date-parts"]), revue: m?.["container-title"]?.[0] ?? "" };
  } catch {
    return null;
  }
}

// Europe PMC : résumé et, s'il est en accès libre, lien vers le PDF
export async function resumeEuropePmc(doi: string, lire: Telechargeur): Promise<Pick<Metadonnees, "resume" | "pdf" | "libre"> | null> {
  try {
    const r = JSON.parse(
      await lire(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&resultType=core&format=json&pageSize=1`),
    ) as {
      resultList?: {
        result?: { abstractText?: string; isOpenAccess?: string; fullTextUrlList?: { fullTextUrl?: { url?: string; documentStyle?: string; availability?: string }[] } }[];
      };
    };
    const x = r.resultList?.result?.[0];
    if (!x) return null;
    const resume = (x.abstractText ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
    const liens = x.fullTextUrlList?.fullTextUrl ?? [];
    const pdf = liens.find((l) => l.documentStyle === "pdf" && /open access|free/i.test(l.availability ?? "") && l.url?.startsWith("https://"))?.url ?? "";
    return { resume, pdf, libre: x.isOpenAccess === "Y" };
  } catch {
    return null;
  }
}

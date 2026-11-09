// Lecture des pages publiques de medicament.ma (liste alphabétique et fiches) et comparaison entre deux relevés.
// Sans accès à la base ni au réseau : testable seul. Le site n'a pas d'API : on lit son HTML, donc toute
// modification de sa structure doit être détectée et signalée (jamais prise pour une suppression).

export type LigneListe = { url: string; nom: string; presentation: string; ppv: string; ph: string; labo: string };

export type Fiche = {
  nom: string;
  generique: boolean;
  presentation: string;
  dosage: string;
  labo: string;
  dci: string;
  classe: string;
  statut: string;
  ppv: string;
  tableau: string;
};

const texte = (h: string) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

export const adresseListe = (lettre: string, page: number) =>
  `https://medicament.ma/listing-des-medicaments/${page > 1 ? `page/${page}/` : ""}?lettre=${encodeURIComponent(lettre)}`;

// Une page de la liste : null si la structure attendue est absente (page d'erreur, site modifié)
export function lireListe(html: string): LigneListe[] | null {
  if (!html.includes('class="listing')) return null;
  const lignes: LigneListe[] = [];
  const re =
    /<li class="listing-item">\s*<a href="(https:\/\/medicament\.ma\/medicament\/[^"]+)">\s*<p class="primary">([\s\S]*?)<\/p>\s*<span class="secondary">([\s\S]*?)<\/span>/g;
  for (const m of html.matchAll(re)) {
    const [, url, nom, resume] = m;
    const ppv = resume.match(/PPV:\s*([\d.,]+\s*dhs)/i)?.[1] ?? "";
    const ph = resume.match(/PH:\s*([\d.,]+\s*dhs)/i)?.[1] ?? "";
    const morceaux = texte(resume).split(" - ").map((s) => s.trim());
    // « Boite de 20 - PPV: 19.10 dhs - PH: 10 dhs - LABORATOIRE » : présentation en tête, laboratoire à la fin
    const presentation = morceaux[0] && !/^PPV|^PH/i.test(morceaux[0]) ? morceaux[0] : "";
    const dernier = morceaux[morceaux.length - 1] ?? "";
    const labo = morceaux.length > 1 && !/^(PPV|PH):/i.test(dernier) ? dernier : "";
    lignes.push({ url, nom: texte(nom), presentation, ppv, ph, labo });
  }
  return lignes;
}

// Une fiche : "introuvable" quand le site répond « Médicament non trouvé », null si la structure a changé
export function lireFiche(html: string): Fiche | "introuvable" | null {
  if (/class="error-title"/.test(html) || /M[ée]dicament non trouv[ée]/i.test(html)) return "introuvable";
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1 || !html.includes("detail-header")) return null;
  const champ = (nom: string) => {
    const m = html.match(
      new RegExp(`detail-header">\\s*${nom}\\s*</div>\\s*<div class="detail-content">([\\s\\S]*?)</div>`, "i"),
    );
    return m ? texte(m[1]) : "";
  };
  return {
    nom: texte(h1[1]),
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

const net = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const prix = (s: string) => net(s).replace(/^ppv:\s*/, "").replace(",", ".");

export type Connu = {
  nom: string;
  presentation: string;
  ppv: string;
  labo: string;
  dci?: string;
  dosage?: string;
  classe?: string;
  statut?: string;
  tableau?: string;
};

// Ce qui a changé entre ce que nous avons et ce que le site affiche : phrases lisibles, vide si rien
export function differences(avant: Connu, apres: Partial<Connu>): string[] {
  const libelles: [keyof Connu, string][] = [
    ["nom", "Nom"],
    ["presentation", "Présentation"],
    ["ppv", "Prix (PPV)"],
    ["labo", "Laboratoire"],
    ["dci", "Substance"],
    ["dosage", "Dosage"],
    ["classe", "Classe"],
    ["statut", "Statut"],
    ["tableau", "Tableau"],
  ];
  const liste: string[] = [];
  for (const [cle, libelle] of libelles) {
    const a = avant[cle];
    const b = apres[cle];
    // champ non relevé d'un côté (la liste est moins détaillée que la fiche) ou jamais connu : pas de comparaison
    if (a === undefined || a === "" || b === undefined || b === "") continue;
    const egal = cle === "ppv" ? prix(a) === prix(b) : net(a) === net(b);
    if (!egal) liste.push(`${libelle} : « ${a || "—"} » → « ${b} »`);
  }
  return liste;
}

// Sécurité : une lecture anormale (liste très amputée) n'est jamais prise pour des retraits
export function lectureSuspecte(connus: number, lus: number) {
  if (connus >= 20 && lus < connus * 0.7) return `${lus} médicaments lus au lieu d'environ ${connus}`;
  return null;
}

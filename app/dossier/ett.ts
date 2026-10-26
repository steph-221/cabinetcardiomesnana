// Compte rendu d'échocardiographie-Doppler (ETT) : les rubriques du modèle du cabinet, dans le même ordre, les calculs
// (surface corporelle, masse VG, PAPS…) et des propositions pour le « AU TOTAL » à partir des seuils publiés.
// Ce sont des aides : le médecin choisit ce qu'il garde. Sans accès à la base (sert aussi dans le navigateur).

import { surfaceCorporelle } from "./calculs";

export type Champ = {
  cle: string;
  libelle: string; // tel qu'il apparaît dans le compte rendu
  unite?: string;
  texte?: boolean; // description libre plutôt qu'un nombre
  min?: number;
  max?: number;
  exemple?: string;
};

export const champs2D: Champ[] = [
  { cle: "ao", libelle: "Diamètre aorte", unite: "mm", min: 10, max: 80 },
  { cle: "ogDiam", libelle: "Diamètre oreillette gauche", unite: "mm", min: 15, max: 90 },
  { cle: "ogSurf", libelle: "Surface OG", unite: "cm²", min: 5, max: 80 },
  { cle: "odSurf", libelle: "Surface OD", unite: "cm²", min: 5, max: 80 },
  { cle: "siv", libelle: "Épaisseur septum interventriculaire", unite: "mm", min: 3, max: 40 },
  { cle: "pp", libelle: "Épaisseur paroi postérieure", unite: "mm", min: 3, max: 40 },
  { cle: "dtd", libelle: "Diamètre ventricule gauche télédiastole", unite: "mm", min: 20, max: 100 },
  { cle: "dts", libelle: "Diamètre ventricule gauche télésystole", unite: "mm", min: 10, max: 90 },
  { cle: "fevg", libelle: "Fraction d'éjection du ventricule gauche", unite: "%", min: 5, max: 90 },
  { cle: "slg", libelle: "Strain longitudinal global", unite: "%", min: -40, max: 0, exemple: "-18" },
  { cle: "cinetique", libelle: "Cinétique VG", texte: true, exemple: "correcte" },
  { cle: "vd", libelle: "VD", texte: true, exemple: "bonne contractilité" },
  { cle: "tapse", libelle: "TAPSE", unite: "mm", min: 3, max: 45 },
  { cle: "pericarde", libelle: "Péricarde", texte: true, exemple: "sec" },
  { cle: "vci", libelle: "VCI", texte: true, exemple: "non dilatée compliante" },
];

export const champsDoppler: Champ[] = [
  { cle: "mitrale", libelle: "Valve mitrale", texte: true, exemple: "fines" },
  { cle: "eMitral", libelle: "Onde E", unite: "m/s", min: 0.1, max: 3 },
  { cle: "eSurEPrime", libelle: "E/E'", min: 1, max: 50 },
  { cle: "surfMitrale", libelle: "Surface mitrale", unite: "cm²", min: 0.3, max: 7 },
  { cle: "gmMitral", libelle: "Gradient moyen mitral", unite: "mmHg", min: 0, max: 40 },
  { cle: "aortique", libelle: "Valve aortique", texte: true, exemple: "fines" },
  { cle: "itv", libelle: "ITV sous-aortique", unite: "cm", min: 5, max: 40 },
  { cle: "vmaxAo", libelle: "Vmax aortique", unite: "m/s", min: 0.5, max: 7 },
  { cle: "gmAo", libelle: "Gradient moyen aortique", unite: "mmHg", min: 0, max: 150 },
  { cle: "surfAo", libelle: "Surface aortique (équation de continuité)", unite: "cm²", min: 0.2, max: 6 },
  { cle: "tricuspide", libelle: "Flux tricuspide", texte: true, exemple: "fuite minime" },
  { cle: "vmaxIt", libelle: "Vmax IT", unite: "m/s", min: 0.5, max: 7 },
  { cle: "pod", libelle: "Pression OD estimée", unite: "mmHg", min: 0, max: 25, exemple: "3" },
  { cle: "anneauTric", libelle: "Anneau tricuspide", unite: "mm", min: 15, max: 70 },
];

export const champsETT = [...champs2D, ...champsDoppler];

export type ValeursETT = Record<string, string | number>;

export type DonneesETT = {
  indication: string;
  operateur: string;
  poids: number | null;
  taille: number | null;
  valeurs: ValeursETT;
  total: string; // « AU TOTAL »
};

const nombre = (v: ValeursETT, cle: string) => (typeof v[cle] === "number" ? (v[cle] as number) : null);

// Valeurs calculées à partir des mesures : surface corporelle, masse VG (Devereux), gradients, PAPS
export function calculsETT(d: Pick<DonneesETT, "poids" | "taille" | "valeurs">) {
  const v = d.valeurs;
  const sc = surfaceCorporelle(d.poids, d.taille);
  const [dtd, siv, pp] = [nombre(v, "dtd"), nombre(v, "siv"), nombre(v, "pp")];
  const masse = dtd && siv && pp ? (0.8 * 1.04 * ((dtd + siv + pp) ** 3 - dtd ** 3)) / 1000 + 0.6 : null; // mm → cm³ puis g
  const vmaxIt = nombre(v, "vmaxIt");
  const gradientVdOd = vmaxIt ? 4 * vmaxIt ** 2 : null;
  const pod = nombre(v, "pod");
  const vmaxAo = nombre(v, "vmaxAo");
  const surfAo = nombre(v, "surfAo");
  return {
    sc,
    masseVG: masse,
    masseVGi: masse && sc ? masse / sc : null,
    epaisseurRelative: dtd && pp ? (2 * pp) / dtd : null,
    gradientVdOd,
    paps: gradientVdOd !== null && pod !== null ? gradientVdOd + pod : null,
    gradientMaxAo: vmaxAo ? 4 * vmaxAo ** 2 : null,
    surfAoIndexee: surfAo && sc ? surfAo / sc : null,
  };
}

export type Proposition = { texte: string; source: string };

// Propositions pour le « AU TOTAL », d'après les seuils usuels (ASE/EACVI, ESC). Rien n'est ajouté sans le médecin.
export function propositionsETT(d: Pick<DonneesETT, "poids" | "taille" | "valeurs">, sexe: "" | "F" | "M") {
  const v = d.valeurs;
  const c = calculsETT(d);
  const p: Proposition[] = [];
  const ajouter = (texte: string, source: string) => p.push({ texte, source });
  const fr = (n: number, chiffres = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: chiffres });

  const fevg = nombre(v, "fevg");
  if (fevg !== null) {
    if (fevg >= 50) ajouter(`Fonction systolique VG conservée (FEVG ${fevg} %).`, "ESC 2021 insuffisance cardiaque");
    else if (fevg >= 41) ajouter(`FEVG modérément altérée à ${fevg} %.`, "ESC 2021 insuffisance cardiaque");
    else ajouter(`Altération de la fonction systolique VG, FEVG ${fevg} %.`, "ESC 2021 insuffisance cardiaque");
  }

  const dtd = nombre(v, "dtd");
  const limiteDtd = sexe === "F" ? 52 : sexe === "M" ? 58 : null;
  if (dtd !== null && limiteDtd !== null && dtd > limiteDtd) {
    ajouter(`Dilatation du ventricule gauche (DTDVG ${dtd} mm).`, "ASE/EACVI 2015");
  }

  const limiteMasse = sexe === "F" ? 95 : sexe === "M" ? 115 : null;
  if (c.masseVGi !== null && limiteMasse !== null && c.masseVGi > limiteMasse) {
    const type = c.epaisseurRelative !== null && c.epaisseurRelative > 0.42 ? "concentrique" : "excentrique";
    ajouter(`Hypertrophie ventriculaire gauche ${type} (masse VG ${Math.round(c.masseVGi)} g/m²).`, "ASE/EACVI 2015");
  }

  const og = nombre(v, "ogSurf");
  const od = nombre(v, "odSurf");
  if (og !== null && og > 20 && od !== null && od > 18) {
    ajouter(`Dilatation des deux oreillettes (OG ${fr(og)} cm², OD ${fr(od)} cm²).`, "ASE/EACVI 2015");
  } else if (og !== null && og > 20) ajouter(`Dilatation de l'oreillette gauche (${fr(og)} cm²).`, "ASE/EACVI 2015");
  else if (od !== null && od > 18) ajouter(`Dilatation de l'oreillette droite (${fr(od)} cm²).`, "ASE/EACVI 2015");

  const eSurE = nombre(v, "eSurEPrime");
  if (eSurE !== null && eSurE > 14) {
    ajouter(`Pressions de remplissage VG élevées (E/E' ${fr(eSurE)}).`, "ASE/EACVI 2016 fonction diastolique");
  }

  const tapse = nombre(v, "tapse");
  if (tapse !== null) {
    ajouter(
      tapse < 17
        ? `Dysfonction systolique du VD (TAPSE ${tapse} mm).`
        : `Bonne fonction systolique longitudinale du VD (TAPSE ${tapse} mm).`,
      "ASE/EACVI 2015",
    );
  }

  const sm = nombre(v, "surfMitrale");
  if (sm !== null) {
    if (sm <= 1) ajouter(`Rétrécissement mitral très serré (surface ${fr(sm)} cm²).`, "ESC valvulopathies");
    else if (sm <= 1.5) ajouter(`Rétrécissement mitral serré (surface ${fr(sm)} cm²).`, "ESC valvulopathies");
    else if (sm < 4) ajouter(`Rétrécissement mitral non serré (surface ${fr(sm)} cm²).`, "ESC valvulopathies");
  }

  // Rétrécissement aortique : surface, Vmax et gradient moyen doivent concorder
  const [sa, vmax, gm] = [nombre(v, "surfAo"), nombre(v, "vmaxAo"), nombre(v, "gmAo")];
  const serreParSurface = sa !== null && sa < 1;
  const serreParGradient = (vmax !== null && vmax >= 4) || (gm !== null && gm >= 40);
  if (serreParSurface && serreParGradient) {
    ajouter(
      `Rétrécissement aortique serré (surface ${fr(sa!)} cm², gradient moyen ${gm ?? "?"} mmHg).`,
      "ESC valvulopathies",
    );
  } else if (serreParSurface && (vmax !== null || gm !== null)) {
    ajouter(
      `Discordance : surface aortique ${fr(sa!)} cm² mais gradient moyen ${gm ?? "?"} mmHg et Vmax ${vmax !== null ? fr(vmax, 2) : "?"} m/s. ` +
        `Rechercher un RAo serré à bas débit (volume d'éjection indexé, surface indexée${c.surfAoIndexee !== null ? ` : ${fr(c.surfAoIndexee, 2)} cm²/m²` : ""}) et vérifier les mesures.`,
      "ESC valvulopathies",
    );
  } else if (serreParGradient) {
    ajouter(
      `Rétrécissement aortique serré (Vmax ${vmax !== null ? fr(vmax, 2) : "?"} m/s, gradient moyen ${gm ?? "?"} mmHg).`,
      "ESC valvulopathies",
    );
  } else if ((vmax !== null && vmax >= 3) || (gm !== null && gm >= 20) || (sa !== null && sa <= 1.5)) {
    ajouter("Rétrécissement aortique moyennement serré.", "ESC valvulopathies");
  }

  const vmaxIt = nombre(v, "vmaxIt");
  if (vmaxIt !== null) {
    const probabilite = vmaxIt <= 2.8 ? "faible" : vmaxIt <= 3.4 ? "intermédiaire" : "élevée";
    ajouter(
      `Probabilité ${probabilite} d'HTAP (Vmax IT ${fr(vmaxIt, 2)} m/s${c.paps !== null ? `, PAPS estimée à ${Math.round(c.paps)} mmHg` : ""}).`,
      "ESC/ERS 2022 hypertension pulmonaire",
    );
  }
  return p;
}

// Lignes du compte rendu, comme dans le modèle du cabinet : « Diamètre aorte : 33 mm ; … »
export function lignesETT(d: DonneesETT) {
  const c = calculsETT(d);
  const fr = (n: number, chiffres = 2) => n.toLocaleString("fr-FR", { maximumFractionDigits: chiffres });
  const valeur = (ch: Champ) => {
    const v = d.valeurs[ch.cle];
    if (v === undefined || v === "") return null;
    const texte = typeof v === "number" ? `${fr(v)}${ch.unite ? ` ${ch.unite}` : ""}` : v;
    if (ch.cle === "fevg") return `${ch.libelle} ${texte} (${d.valeurs.methodeFevg || "SBP"})`;
    return `${ch.libelle} : ${texte}`;
  };
  const mesures2D = champs2D.map(valeur).filter((l): l is string => Boolean(l));
  if (c.masseVGi !== null) mesures2D.push(`Masse VG indexée : ${Math.round(c.masseVGi)} g/m²`);
  const doppler = champsDoppler
    .filter((ch) => ch.cle !== "pod")
    .map(valeur)
    .filter((l): l is string => Boolean(l));
  if (c.gradientVdOd !== null) doppler.push(`Gradient VD-OD : ${Math.round(c.gradientVdOd)} mmHg`);
  if (c.paps !== null) doppler.push(`PAPS estimée : ${Math.round(c.paps)} mmHg`);
  return { mesures2D, doppler, sc: c.sc };
}

import { describe, expect, it } from "vitest";
import { ecg, qtCorrige } from "./definitions/ecg";
import { effort, duke } from "./definitions/effort";
import { baisseNocturne, mapa } from "./definitions/mapa";
import { modelesExamen, trouverModele } from "./index";
import { champs, lignesExamen } from "./types";

const textes = (p: { texte: string }[]) => p.map((x) => x.texte).join(" | ");
const homme = { age: 56, sexe: "M" as const };

describe("registre", () => {
  it("chaque clé de champ est unique et chaque modèle a un type d'examen", () => {
    for (const m of modelesExamen) {
      const cles = champs(m).map((c) => c.cle);
      expect(new Set(cles).size, m.cle).toBe(cles.length);
      expect(trouverModele(m.cle)).toBe(m);
      for (const c of champs(m)) if (c.type === "choix") expect(c.options?.length, c.cle).toBeGreaterThan(0);
    }
  });
});

describe("ECG", () => {
  it("QTc de Fridericia et Bazett à 60 bpm : égal au QT", () => {
    const q = qtCorrige(400, 60);
    expect(q.bazett).toBeCloseTo(400);
    expect(q.fridericia).toBeCloseTo(400);
  });
  it("propose bradycardie, BAV1, QRS élargis, QTc allongé et axe gauche", () => {
    const t = textes(ecg.propositions({ rythme: "sinusal régulier", fc: 48, pr: 230, qrs: 130, qt: 520, axe: -45 }, homme));
    expect(t).toContain("Bradycardie sinusale");
    expect(t).toContain("Bloc auriculo-ventriculaire du 1er degré");
    expect(t).toContain("QRS élargis");
    expect(t).toContain("QTc allongé");
    expect(t).toContain("Déviation axiale gauche");
  });
  it("tracé normal : rythme sinusal et QTc normal", () => {
    const t = textes(ecg.propositions({ rythme: "sinusal régulier", fc: 70, pr: 160, qrs: 90, qt: 400, axe: 50 }, homme));
    expect(t).toContain("Rythme sinusal régulier à 70 bpm");
    expect(t).toContain("QTc normal");
  });
  it("le seuil du QTc est plus haut chez la femme", () => {
    const v = { rythme: "sinusal régulier", fc: 60, qt: 475 };
    expect(textes(ecg.propositions(v, { age: 40, sexe: "M" }))).toContain("QTc allongé");
    expect(textes(ecg.propositions(v, { age: 40, sexe: "F" }))).toContain("QTc normal");
  });
});

describe("MAPA", () => {
  it("baisse nocturne et profil", () => {
    expect(baisseNocturne(140, 119)).toBeCloseTo(15);
    expect(mapa.calculs({ pasJour: 140, pasNuit: 119 }, homme).join(" ")).toContain("dipper");
    expect(mapa.calculs({ pasJour: 130, pasNuit: 140 }, homme).join(" ")).toContain("riser");
  });
  it("non traité : HTA confirmée, blouse blanche, masquée, normotension", () => {
    const base = { traitement: "non traité", nbJour: 40, nbNuit: 12 };
    const haut = { pas24: 145, pad24: 88, pasJour: 148, padJour: 90, pasNuit: 130, padNuit: 75 };
    const normal = { pas24: 118, pad24: 72, pasJour: 122, padJour: 76, pasNuit: 105, padNuit: 62 };
    expect(textes(mapa.propositions({ ...base, ...haut, pasConsult: 160, padConsult: 95 }, homme))).toContain("confirmée");
    expect(textes(mapa.propositions({ ...base, ...normal, pasConsult: 160, padConsult: 95 }, homme))).toContain("blouse blanche");
    expect(textes(mapa.propositions({ ...base, ...haut, pasConsult: 130, padConsult: 80 }, homme))).toContain("HTA masquée");
    expect(textes(mapa.propositions({ ...base, ...normal, pasConsult: 125, padConsult: 78 }, homme))).toContain("Normotension");
  });
  it("traité : contrôlée ou non contrôlée", () => {
    const base = { traitement: "traité", nbJour: 40, nbNuit: 12, pasConsult: 150, padConsult: 90 };
    expect(textes(mapa.propositions({ ...base, pas24: 120, pad24: 70, pasJour: 125, padJour: 75, pasNuit: 105, padNuit: 60 }, homme))).toContain(
      "blouse blanche sous traitement",
    );
    expect(textes(mapa.propositions({ ...base, pas24: 140, pad24: 85, pasJour: 142, padJour: 88, pasNuit: 128, padNuit: 72 }, homme))).toContain(
      "non contrôlée",
    );
  });
  it("signale un enregistrement insuffisant", () => {
    expect(textes(mapa.propositions({ nbJour: 12, nbNuit: 3 }, homme))).toContain("validité insuffisante");
  });
});

describe("Épreuve d'effort", () => {
  it("FMT et pourcentage atteint : 56 ans, 126 bpm = 77 %", () => {
    const l = effort.calculs({ fcMax: 126 }, homme).join(" ");
    expect(l).toContain("164 bpm");
    expect(l).toContain("139 bpm");
    expect(l).toContain("77 %");
  });
  it("test sous-maximal négatif : non concluant", () => {
    const t = textes(
      effort.propositions({ fcMax: 126, stPente: "sans sous-décalage", angor: "absent", pasRepos: 118, pasPic: 140 }, homme),
    );
    expect(t).toContain("sous-maximal");
    expect(t).toContain("non concluante");
    expect(t).toContain("Bonne adaptation tensionnelle");
  });
  it("test maximal négatif", () => {
    const t = textes(effort.propositions({ fcMax: 150, stPente: "sans sous-décalage", angor: "absent" }, homme));
    expect(t).toContain("Épreuve d'effort négative");
  });
  it("sous-décalage horizontal de 2 mm : positif ; Duke", () => {
    const v = { type: "tapis roulant", duree: 8, stPente: "horizontal", stMax: 2, angor: "non limitant", fcMax: 160 };
    expect(duke(v)).toBe(8 - 10 - 4);
    const t = textes(effort.propositions(v, homme));
    expect(t).toContain("test électriquement positif");
    expect(t).toContain("risque intermédiaire");
    expect(t).not.toContain("négative");
  });
  it("un sous-décalage ascendant lent ne compte pas dans le Duke", () => {
    expect(duke({ type: "tapis roulant", duree: 9, stPente: "ascendant lent", stMax: 2, angor: "absent" })).toBe(9);
    expect(duke({ type: "bicyclette ergométrique", duree: 9, angor: "absent" })).toBeNull();
  });
  it("réponse tensionnelle : exagérée ou chute", () => {
    expect(textes(effort.propositions({ pasRepos: 140, pasPic: 220 }, homme))).toContain("exagérée");
    expect(textes(effort.propositions({ pasRepos: 140, pasPic: 220 }, { age: 50, sexe: "F" }))).toContain("exagérée");
    expect(textes(effort.propositions({ pasRepos: 140, pasPic: 130 }, homme))).toContain("Chute de la PAS");
  });
});

describe("lignes du compte rendu", () => {
  it("n'écrit que les champs remplis, avec l'unité", () => {
    const r = lignesExamen(ecg, { valeurs: { rythme: "sinusal régulier", fc: 72, qt: 400 }, age: 50, sexe: "M" });
    expect(r.sections[0].lignes).toEqual(["Rythme : sinusal régulier", "Fréquence cardiaque : 72 bpm", "QT : 400 ms"]);
    expect(r.sections).toHaveLength(1);
    expect(r.calculs[0]).toContain("QTc Fridericia");
  });
});

describe("compatibilité PDF", () => {
  it("le signe moins typographique est remplacé par un tiret dans les PDF", async () => {
    const { propre } = await import("../pdf");
    expect(propre("220 − âge")).toBe("220 - âge");
    expect(propre("103\u202f680 complexes")).toBe("103 680 complexes");
  });
});

describe("Holter", () => {
  const holter = trouverModele("holter")!;
  it("nombre de complexes et charge d'ESV : 24 h à 72 bpm", () => {
    const l = holter.calculs({ duree: 24, fcMoy: 72, nbESV: 10368 }, homme).join(" ").replaceAll("\u202f", " ");
    expect(l).toContain("103 680");
    expect(l).toContain("10 %");
  });
  it("charge > 10 %, TV non soutenue, pause et FA paroxystique", () => {
    const t = textes(
      holter.propositions(
        { duree: 24, fcMoy: 72, nbESV: 20000, salvesTV: 2, detailTV: "5 complexes à 160 bpm", pauseMax: 3.4, fa: "paroxystique", fcMin: 38 },
        homme,
      ),
    );
    expect(t).toContain("Charge d'extrasystoles ventriculaires élevée");
    expect(t).toContain("Tachycardie ventriculaire non soutenue (2 salves) : 5 complexes à 160 bpm");
    expect(t).toContain("Pause maximale de 3,4 s");
    expect(t).toContain("Fibrillation atriale paroxystique");
    expect(t).toContain("Bradycardie");
  });
  it("enregistrement sans anomalie", () => {
    const t = textes(holter.propositions({ duree: 24, fcMoy: 72, fcMin: 48, nbESV: 300, salvesTV: 0, pauseMax: 1.8, fa: "absente" }, homme));
    expect(t).toContain("Pas d'arythmie significative");
    expect(t).not.toContain("Charge");
  });
});

describe("Doppler veineux", () => {
  const veineux = trouverModele("doppler-veineux")!;
  it("thrombose absente, reflux et adénopathie", () => {
    const t = textes(
      veineux.propositions(
        { cote: "droit", thrombose: "absente", segments: "fémoral, poplité", refluxGVS: 0.2, adenopathie: "inguinale" },
        homme,
      ),
    );
    expect(t).toContain("Pas de thrombose veineuse profonde du membre inférieur droit sur les segments examinés (fémoral, poplité)");
    expect(t).toContain("Pas de signe d'insuffisance veineuse");
    expect(t).toContain("Adénopathie associée");
  });
  it("reflux de la grande saphène à 1,2 s ; thrombose proximale", () => {
    expect(textes(veineux.propositions({ refluxGVS: 1.2 }, homme))).toContain("Reflux de la grande saphène (1,2 s");
    expect(textes(veineux.propositions({ thrombose: "proximale (fémoro-poplitée ou iliaque)" }, homme))).toContain("proximale");
  });
  it("signale une incohérence de compressibilité", () => {
    expect(veineux.calculs({ compressibilite: "non compressible", thrombose: "absente" }, homme)[0]).toContain("Vérifier");
  });
});

describe("Doppler artériel : IPS", () => {
  const arteriel = trouverModele("doppler-arteriel")!;
  it("prend la pression de cheville la plus haute sur la brachiale", () => {
    const l = arteriel.calculs({ pasBras: 150, pasTibialeD: 120, pasPedieuseD: 135, pasTibialeG: 90 }, homme);
    expect(l).toEqual(["IPS droit : 0,9", "IPS gauche : 0,6"]);
  });
  it("paliers : normal, limite, artériopathie, incompressible", () => {
    const ips = (cheville: number) => textes(arteriel.propositions({ pasBras: 100, pasTibialeD: cheville }, homme));
    expect(ips(110)).toContain("normal");
    expect(ips(95)).toContain("limite");
    expect(ips(80)).toContain("artériopathie oblitérante des membres inférieurs, légère à modérée");
    expect(ips(50)).toContain("modérée à sévère");
    expect(ips(30)).toContain("sévère (ischémie critique possible)");
    expect(ips(150)).toContain("incompressibles");
  });
});

describe("Doppler TSA", () => {
  const tsa = trouverModele("doppler-tsa")!;
  it("sténose de l'ACI d'après la vitesse", () => {
    const t = textes(tsa.propositions({ psvD: 100, psvG: 180 }, homme));
    expect(t).toContain("ACI droite : vitesse systolique 100 cm/s, sténose < 50 %.");
    expect(t).toContain("ACI gauche : vitesse systolique 180 cm/s, sténose de 50 à 69 %");
    expect(textes(tsa.propositions({ psvD: 250 }, homme))).toContain("sténose ≥ 70 %");
  });
  it("flux vertébral inversé et épaisseur intima-média", () => {
    const t = textes(tsa.propositions({ vertebraleG: "flux inversé", epaisseur: 1.1 }, homme));
    expect(t).toContain("vol sous-clavier");
    expect(t).toContain("Épaisseur intima-média augmentée");
  });
});

describe("Coroscanner : CAD-RADS", () => {
  const scanner = trouverModele("coroscanner")!;
  const cad = (v: Record<string, string | number>) => scanner.calculs(v, homme).join(" ");
  const aucune = "pas de sténose";
  it("0 : aucune sténose et score calcique nul", () => {
    expect(cad({ tc: aucune, iva: aucune, cx: aucune, cd: aucune, agatston: 0 })).toContain("CAD-RADS 0");
  });
  it("1 : plaque sans sténose (score calcique > 0) ou sténose minime", () => {
    expect(cad({ tc: aucune, iva: aucune, cx: aucune, cd: aucune, agatston: 40 })).toContain("CAD-RADS 1");
    expect(cad({ iva: "minime (1 à 24 %)" })).toContain("CAD-RADS 1");
  });
  it("2 et 3 d'après la sténose la plus serrée", () => {
    expect(cad({ iva: "légère (25 à 49 %)", cd: "minime (1 à 24 %)" })).toContain("CAD-RADS 2");
    expect(cad({ iva: "modérée (50 à 69 %)", cd: "légère (25 à 49 %)" })).toContain("CAD-RADS 3");
  });
  it("4A : une ou deux artères ≥ 70 % ; 4B : trois artères ou tronc commun ≥ 50 %", () => {
    expect(cad({ iva: "sévère (70 à 99 %)", cx: "sévère (70 à 99 %)" })).toContain("CAD-RADS 4A");
    expect(cad({ iva: "sévère (70 à 99 %)", cx: "sévère (70 à 99 %)", cd: "sévère (70 à 99 %)" })).toContain("CAD-RADS 4B");
    expect(cad({ tc: "modérée (50 à 69 %)" })).toContain("CAD-RADS 4B");
  });
  it("5 : occlusion", () => {
    expect(cad({ cd: "occlusion (100 %)", iva: "sévère (70 à 99 %)" })).toContain("CAD-RADS 5");
  });
  it("segments non évaluables : catégorie provisoire", () => {
    expect(cad({ iva: "légère (25 à 49 %)", cx: "non évaluable" })).toContain("provisoire");
  });
  it("sans artère renseignée : pas de CAD-RADS", () => {
    expect(cad({ agatston: 120 })).not.toContain("CAD-RADS");
    expect(cad({ agatston: 120 })).toContain("charge de plaque P2");
    expect(textes(scanner.propositions({ tc: "modérée (50 à 69 %)" }, homme))).toContain("coronarographie recommandée");
    expect(textes(scanner.propositions({ tc: "modérée (50 à 69 %)" }, homme))).not.toContain("équipe");
  });
  it("propose la conduite à discuter", () => {
    expect(textes(scanner.propositions({ iva: "modérée (50 à 69 %)", agatston: 250 }, homme))).toContain("test fonctionnel");
  });
});

describe("Coronarographie", () => {
  const coro = trouverModele("coronarographie")!;
  it("atteinte mono, bi, tritronculaire et tronc commun", () => {
    const grave = "sévère (70 à 99 %)";
    expect(textes(coro.propositions({ iva: grave }, homme))).toContain("monotronculaire");
    expect(textes(coro.propositions({ iva: grave, cd: grave }, homme))).toContain("bitronculaire");
    expect(textes(coro.propositions({ iva: grave, cx: grave, cd: "occlusion (100 %)" }, homme))).toContain("tritronculaire");
    expect(textes(coro.propositions({ tc: "modérée (50 à 69 %)" }, homme))).toContain("tronc commun gauche");
  });
  it("coronaires normales, lésions non significatives, sténose intermédiaire", () => {
    const n = "pas de sténose";
    expect(textes(coro.propositions({ tc: n, iva: n, cx: n, cd: n }, homme))).toContain("angiographiquement normales");
    expect(textes(coro.propositions({ iva: "légère (25 à 49 %)" }, homme))).toContain("non significatives");
    expect(textes(coro.propositions({ iva: "modérée (50 à 69 %)" }, homme))).toContain("FFR, iFR");
  });
  it("FFR et iFR : seuils 0,80 et 0,89", () => {
    expect(textes(coro.propositions({ ffr: 0.78 }, homme))).toContain("significative (seuil 0,80)");
    expect(textes(coro.propositions({ ffr: 0.86 }, homme))).toContain("non significative");
    expect(textes(coro.propositions({ ifr: 0.85 }, homme))).toContain("significative (seuil 0,89)");
  });
  it("FEVG et geste", () => {
    const t = textes(coro.propositions({ fevg: 35, geste: "angioplastie avec stent actif", detailGeste: "IVA moyenne, stent 3,0 x 18 mm" }, homme));
    expect(t).toContain("Altération de la fonction systolique");
    expect(t).toContain("Angioplastie avec stent actif : IVA moyenne, stent 3,0 x 18 mm.");
  });
  it("compte les artères ≥ 70 %", () => {
    expect(coro.calculs({ iva: "sévère (70 à 99 %)", cx: "légère (25 à 49 %)" }, homme)[0]).toContain("1 sur 3");
  });
});

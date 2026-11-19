// Chaque règle de l'inventaire (seuils.ts) est contrôlée sur ses valeurs limites : si quelqu'un modifie un seuil dans le
// code sans mettre l'inventaire à jour (ou l'inverse), ce test échoue. Il ne dit pas que le seuil est juste : c'est le
// rôle de la vérification contre les recommandations.

import { describe, expect, it } from "vitest";
import { propositionsETT } from "../ett";
import { categorieCalcique } from "./definitions/coronaires";
import { duke } from "./definitions/effort";
import { trouverModele } from "./index";
import { avecSeuils, SANS_REFERENCE } from "./references-propositions";
import { seuils } from "./seuils";
import type { Contexte, ValeursExamen } from "./types";

const H: Contexte = { age: 50, sexe: "M" };
const F: Contexte = { age: 50, sexe: "F" };
const ids = new Set(seuils.map((s) => s.id));
// Toute proposition qui s'appuie sur une recommandation doit renvoyer à une règle de l'inventaire (pour afficher sa référence)
const texteVerifie = (modele: string, propositions: { texte: string; source: string }[]) =>
  avecSeuils(modele, propositions)
    .map((p) => {
      if (!SANS_REFERENCE.includes(p.source)) {
        expect(p.seuils.length, `${modele} : « ${p.texte} » (${p.source}) n'a pas de règle`).toBeGreaterThan(0);
        for (const id of p.seuils) expect(ids.has(id), id).toBe(true);
      }
      return p.texte;
    })
    .join(" | ");
const prop = (cle: string, v: ValeursExamen, c: Contexte = H) => texteVerifie(cle, trouverModele(cle)!.propositions(v, c));
const calc = (cle: string, v: ValeursExamen, c: Contexte = H) => trouverModele(cle)!.calculs(v, c).join(" | ");
const ett = (valeurs: Record<string, number>, sexe: "M" | "F" = "M", poids: number | null = null, taille: number | null = null) =>
  texteVerifie("ett", propositionsETT({ poids, taille, valeurs }, sexe));

const sin = "sinusal régulier";
const base = { traitement: "non traité", nbJour: 40, nbNuit: 12 };
const hors = { pasConsult: 150, padConsult: 95 }; // consultation élevée : HTA confirmée ou blouse blanche
const bas = { pas24: 110, pad24: 70, pasJour: 115, padJour: 72, pasNuit: 100, padNuit: 60 };
const confirmee = (v: ValeursExamen) => prop("mapa", { ...base, ...hors, ...bas, ...v }).includes("confirmée");
const ips = (cheville: number) => prop("doppler-arteriel", { pasBras: 100, pasTibialeD: cheville });
const duree = (st: number, d = 10) => prop("effort", { type: "tapis roulant", duree: d, stPente: "horizontal", stMax: st, angor: "absent" });
const CAD = (v: ValeursExamen) => calc("coroscanner", v);
const grave = "sévère (70 à 99 %)";

const verifs: Record<string, () => void> = {
  "ecg-frequence": () => {
    expect(prop("ecg", { rythme: sin, fc: 59 })).toContain("Bradycardie");
    expect(prop("ecg", { rythme: sin, fc: 60 })).not.toContain("Bradycardie");
    expect(prop("ecg", { rythme: sin, fc: 100 })).not.toContain("Tachycardie");
    expect(prop("ecg", { rythme: sin, fc: 101 })).toContain("Tachycardie");
  },
  "ecg-fa-rapide": () => {
    expect(prop("ecg", { rythme: "fibrillation atriale", fc: 111 })).toContain("rapide");
    expect(prop("ecg", { rythme: "fibrillation atriale", fc: 110 })).not.toContain("rapide");
  },
  "ecg-pr": () => {
    expect(prop("ecg", { pr: 201 })).toContain("1er degré");
    expect(prop("ecg", { pr: 200 })).not.toContain("1er degré");
    expect(prop("ecg", { pr: 119 })).toContain("PR court");
    expect(prop("ecg", { pr: 120 })).not.toContain("PR court");
  },
  "ecg-qrs": () => {
    expect(prop("ecg", { qrs: 120 })).toContain("QRS élargis");
    expect(prop("ecg", { qrs: 119 })).toContain("QRS limites");
    expect(prop("ecg", { qrs: 110 })).toContain("QRS limites");
    expect(prop("ecg", { qrs: 109 })).toBe("");
  },
  "ecg-qtc": () => {
    const q = (qt: number, c: Contexte) => prop("ecg", { fc: 60, qt }, c); // à 60 bpm, QTc = QT
    expect(q(469, H)).toContain("QTc normal");
    expect(q(470, H)).toContain("QTc allongé");
    expect(q(479, F)).toContain("QTc normal");
    expect(q(480, F)).toContain("QTc allongé");
    expect(q(499, H)).not.toContain("torsades");
    expect(q(500, H)).toContain("torsades");
  },
  "ecg-axe": () => {
    expect(prop("ecg", { axe: -31 })).toContain("gauche");
    expect(prop("ecg", { axe: -30 })).toBe("");
    expect(prop("ecg", { axe: 91 })).toContain("droite");
    expect(prop("ecg", { axe: 90 })).toBe("");
  },
  "holter-bradycardie": () => {
    expect(prop("holter", { fcMin: 39 })).toContain("Bradycardie");
    expect(prop("holter", { fcMin: 40 })).not.toContain("Bradycardie");
  },
  "holter-fc-moyenne": () => {
    expect(prop("holter", { fcMoy: 101 })).toContain("FC moyenne élevée");
    expect(prop("holter", { fcMoy: 100 })).not.toContain("FC moyenne élevée");
  },
  "holter-esv": () => {
    // 24 h à 100 bpm : 144 000 complexes, 10 % = 14 400
    expect(prop("holter", { duree: 24, fcMoy: 100, nbESV: 14401 })).toContain("Charge d'extrasystoles ventriculaires élevée");
    expect(prop("holter", { duree: 24, fcMoy: 100, nbESV: 14400 })).not.toContain("Charge d'extrasystoles ventriculaires élevée");
  },
  "holter-tv": () => {
    expect(prop("holter", { salvesTV: 1 })).toContain("Tachycardie ventriculaire non soutenue");
    expect(prop("holter", { salvesTV: 0 })).not.toContain("Tachycardie ventriculaire");
  },
  "holter-pauses": () => {
    expect(prop("holter", { pauseMax: 3 })).toContain("Pause");
    expect(prop("holter", { pauseMax: 2.9 })).not.toContain("Pause");
  },
  "holter-fa": () => {
    expect(prop("holter", { fa: "paroxystique" })).toContain("CHA₂DS₂-VA");
  },
  "mapa-seuils": () => {
    expect(confirmee({ pas24: 130 })).toBe(true);
    expect(confirmee({ pad24: 80 })).toBe(true);
    expect(confirmee({ pas24: 129, pad24: 79 })).toBe(false);
    expect(confirmee({ pasJour: 135 })).toBe(true);
    expect(confirmee({ padJour: 85 })).toBe(true);
    expect(confirmee({ pasJour: 134, padJour: 84 })).toBe(false);
    expect(confirmee({ pasNuit: 120 })).toBe(true);
    expect(confirmee({ padNuit: 70 })).toBe(true);
    expect(confirmee({ pasNuit: 119, padNuit: 69 })).toBe(false);
  },
  "mapa-consultation": () => {
    const eleve = { pas24: 140, pad24: 85 };
    const m = (pc: number, pd: number) => prop("mapa", { ...base, ...bas, ...eleve, pasConsult: pc, padConsult: pd });
    expect(m(140, 80)).toContain("confirmée");
    expect(m(130, 90)).toContain("confirmée");
    expect(m(139, 89)).toContain("HTA masquée");
  },
  "mapa-validite": () => {
    expect(prop("mapa", { nbJour: 19, nbNuit: 12 })).toContain("validité insuffisante");
    expect(prop("mapa", { nbJour: 20, nbNuit: 7 })).not.toContain("validité insuffisante");
    expect(prop("mapa", { nbJour: 40, nbNuit: 6 })).toContain("validité insuffisante");
  },
  "mapa-profil": () => {
    const profil = (nuit: number) => calc("mapa", { pasJour: 100, pasNuit: nuit });
    expect(profil(101)).toContain("riser");
    expect(profil(100)).toContain("non-dipper");
    expect(profil(91)).toContain("non-dipper");
    expect(profil(90)).toContain("(dipper)");
    expect(profil(80)).toContain("(dipper)");
    expect(profil(79)).toContain("extrême dipper");
  },
  "effort-fmt": () => {
    expect(calc("effort", {}, { age: 50, sexe: "M" })).toContain("FMT théorique 170 bpm");
    expect(calc("effort", {}, { age: 60, sexe: "M" })).toContain("FMT théorique 160 bpm");
  },
  "effort-maximal": () => {
    // 50 ans : FMT 170, 85 % = 144,5 bpm
    expect(prop("effort", { fcMax: 145 })).toContain("Effort maximal");
    expect(prop("effort", { fcMax: 144 })).toContain("sous-maximal");
    expect(prop("effort", { fcMax: 144, stPente: "sans sous-décalage", angor: "absent" })).toContain("non concluante");
  },
  "effort-st": () => {
    expect(prop("effort", { stPente: "horizontal", stMax: 1 })).toContain("électriquement positif");
    expect(prop("effort", { stPente: "descendant", stMax: 2 })).toContain("électriquement positif");
    expect(prop("effort", { stPente: "horizontal", stMax: 0.9 })).not.toContain("électriquement positif");
    expect(prop("effort", { stPente: "ascendant lent", stMax: 2 })).not.toContain("électriquement positif");
  },
  "effort-duke": () => {
    expect(duke({ type: "tapis roulant", duree: 10, stPente: "horizontal", stMax: 1, angor: "absent" })).toBe(5);
    expect(duree(1)).toContain("risque faible"); // 10 − 5 = 5
    expect(duree(1.2)).toContain("risque intermédiaire"); // 10 − 6 = 4
    expect(duree(4)).toContain("risque intermédiaire"); // 10 − 20 = −10
    expect(duree(4, 9)).toContain("risque élevé"); // 9 − 20 = −11
    expect(prop("effort", { type: "bicyclette ergométrique", duree: 10, angor: "absent" })).not.toContain("Duke");
  },
  "effort-pas-exageree": () => {
    expect(prop("effort", { pasPic: 210 }, H)).toContain("exagérée");
    expect(prop("effort", { pasPic: 209 }, H)).not.toContain("exagérée");
    expect(prop("effort", { pasPic: 190 }, F)).toContain("exagérée");
    expect(prop("effort", { pasPic: 189 }, F)).not.toContain("exagérée");
  },
  "effort-chute": () => {
    expect(prop("effort", { pasRepos: 140, pasPic: 139 })).toContain("Chute de la PAS");
    expect(prop("effort", { pasRepos: 140, pasPic: 140 })).not.toContain("Chute de la PAS");
  },
  "veineux-reflux": () => {
    expect(prop("doppler-veineux", { refluxGVS: 0.6 })).toContain("Reflux de la grande saphène");
    expect(prop("doppler-veineux", { refluxGVS: 0.5 })).not.toContain("Reflux de la grande saphène");
    expect(prop("doppler-veineux", { refluxProfond: 1.1 })).toContain("Reflux veineux profond");
    expect(prop("doppler-veineux", { refluxProfond: 1 })).not.toContain("Reflux veineux profond");
  },
  "veineux-tvp": () => {
    expect(prop("doppler-veineux", { thrombose: "absente" })).toContain("Pas de thrombose veineuse profonde");
    expect(prop("doppler-veineux", { thrombose: "proximale (fémoro-poplitée ou iliaque)" })).toContain("proximale");
    expect(prop("doppler-veineux", { thrombose: "distale (jambière)" })).toContain("distale");
    expect(prop("doppler-veineux", { thrombose: "musculaire (surale)" })).toContain("musculaire");
    expect(prop("doppler-veineux", { thrombose: "superficielle" })).toContain("superficielle");
  },
  "ips-seuils": () => {
    expect(ips(90)).toContain("artériopathie");
    expect(ips(91)).toContain("limite");
    expect(ips(99)).toContain("limite");
    expect(ips(100)).toContain("normal");
    expect(ips(140)).toContain("normal");
    expect(ips(141)).toContain("incompressibles");
  },
  "ips-gravite": () => {
    expect(ips(70)).toContain("légère à modérée");
    expect(ips(69)).toContain("modérée à sévère");
    expect(ips(40)).toContain("modérée à sévère");
    expect(ips(39)).toContain("sévère (ischémie critique possible)");
  },
  "tsa-vitesse": () => {
    const t = (psv: number) => prop("doppler-tsa", { psvD: psv });
    expect(t(124)).toContain("sténose < 50 %");
    expect(t(125)).toContain("50 à 69 %");
    expect(t(230)).toContain("50 à 69 %");
    expect(t(231)).toContain("≥ 70 %");
  },
  "tsa-epaisseur": () => {
    expect(prop("doppler-tsa", { epaisseur: 0.9 })).toBe("");
    expect(prop("doppler-tsa", { epaisseur: 1 })).toContain("Épaisseur intima-média augmentée");
  },
  "cad-rads": () => {
    expect(CAD({ tc: "pas de sténose", iva: "pas de sténose", cx: "pas de sténose", cd: "pas de sténose", agatston: 0 })).toContain("CAD-RADS 0");
    expect(CAD({ iva: "minime (1 à 24 %)" })).toContain("CAD-RADS 1");
    expect(CAD({ iva: "pas de sténose", agatston: 10 })).toContain("CAD-RADS 1");
    expect(CAD({ iva: "légère (25 à 49 %)" })).toContain("CAD-RADS 2");
    expect(CAD({ iva: "modérée (50 à 69 %)" })).toContain("CAD-RADS 3");
    expect(CAD({ iva: grave, cx: grave })).toContain("CAD-RADS 4A");
    expect(CAD({ iva: grave, cx: grave, cd: grave })).toContain("CAD-RADS 4B");
    expect(CAD({ tc: "modérée (50 à 69 %)" })).toContain("CAD-RADS 4B");
    expect(CAD({ tc: "légère (25 à 49 %)" })).toContain("CAD-RADS 2");
    expect(CAD({ cd: "occlusion (100 %)" })).toContain("CAD-RADS 5");
    expect(prop("coroscanner", { iva: "modérée (50 à 69 %)", agatston: 250 })).toContain("test fonctionnel");
  },
  calcique: () => {
    expect([0, 1, 99, 100, 299, 300].map(categorieCalcique)).toEqual(["A0", "A1", "A1", "A2", "A2", "A3"]);
  },
  "coro-significatif": () => {
    expect(prop("coronarographie", { iva: grave })).toContain("monotronculaire");
    expect(prop("coronarographie", { iva: "modérée (50 à 69 %)" })).toContain("Sténose intermédiaire");
    expect(prop("coronarographie", { iva: "légère (25 à 49 %)" })).toContain("non significatives");
    expect(prop("coronarographie", { tc: "modérée (50 à 69 %)" })).toContain("tronc commun");
    expect(prop("coronarographie", { tc: "légère (25 à 49 %)" })).not.toContain("tronc commun");
  },
  "coro-ffr": () => {
    expect(prop("coronarographie", { ffr: 0.8 })).toContain("significative (seuil 0,80)");
    expect(prop("coronarographie", { ffr: 0.81 })).toContain("non significative");
    expect(prop("coronarographie", { ifr: 0.89 })).toContain("significative (seuil 0,89)");
    expect(prop("coronarographie", { ifr: 0.9 })).toContain("non significative");
  },
  fevg: () => {
    const e = (f: number) => ett({ fevg: f });
    const c = (f: number) => prop("coronarographie", { fevg: f });
    expect(e(50)).toContain("conservée");
    expect(e(49)).toContain("modérément altérée");
    expect(e(41)).toContain("modérément altérée");
    expect(e(40)).toContain("Altération");
    expect(c(50)).toContain("conservée");
    expect(c(49)).toContain("modérément altérée");
    expect(c(40)).toContain("Altération");
  },
  "ett-dtd": () => {
    expect(ett({ dtd: 59 }, "M")).toContain("Dilatation du ventricule gauche");
    expect(ett({ dtd: 58 }, "M")).not.toContain("Dilatation du ventricule gauche");
    expect(ett({ dtd: 53 }, "F")).toContain("Dilatation du ventricule gauche");
    expect(ett({ dtd: 52 }, "F")).not.toContain("Dilatation du ventricule gauche");
  },
  "ett-masse": () => {
    // Surface corporelle de 1,82 m² (70 kg, 170 cm)
    expect(ett({ dtd: 50, siv: 14, pp: 14 }, "M", 70, 170)).toContain("Hypertrophie ventriculaire gauche concentrique");
    expect(ett({ dtd: 46, siv: 9, pp: 9 }, "M", 70, 170)).not.toContain("Hypertrophie");
    // masse indexée d'environ 107 g/m² : au-dessus du seuil de la femme (95), sous celui de l'homme (115)
    expect(ett({ dtd: 48, siv: 11, pp: 11 }, "F", 70, 170)).toContain("Hypertrophie ventriculaire gauche");
    expect(ett({ dtd: 48, siv: 11, pp: 11 }, "M", 70, 170)).not.toContain("Hypertrophie");
  },
  "ett-rm": () => {
    expect(ett({ surfMitrale: 1 })).toContain("très serré");
    expect(ett({ surfMitrale: 1.5 })).toContain("mitral serré");
    expect(ett({ surfMitrale: 1.6 })).toContain("non serré");
    expect(ett({ surfMitrale: 4 })).toBe("");
  },
  "ett-rao": () => {
    expect(ett({ surfAo: 0.8, vmaxAo: 4.2, gmAo: 45 })).toContain("Rétrécissement aortique serré");
    expect(ett({ surfAo: 0.8, vmaxAo: 3, gmAo: 30 })).toContain("Discordance");
    expect(ett({ vmaxAo: 3.5 })).toContain("moyennement serré");
    expect(ett({ vmaxAo: 2.5, gmAo: 15, surfAo: 2 })).toBe("");
  },
  "ett-oreillettes": () => {
    expect(ett({ ogSurf: 21 })).toContain("oreillette gauche");
    expect(ett({ ogSurf: 20 })).not.toContain("oreillette");
    expect(ett({ odSurf: 19 })).toContain("oreillette droite");
    expect(ett({ odSurf: 18 })).not.toContain("oreillette");
  },
  "ett-eee": () => {
    expect(ett({ eSurEPrime: 15 })).toContain("Pressions de remplissage VG élevées");
    expect(ett({ eSurEPrime: 14 })).not.toContain("Pressions de remplissage");
  },
  "ett-tapse": () => {
    expect(ett({ tapse: 16 })).toContain("Dysfonction systolique du VD");
    expect(ett({ tapse: 17 })).toContain("Bonne fonction systolique longitudinale du VD");
  },
  "ett-htp": () => {
    expect(ett({ vmaxIt: 2.8 })).toContain("Probabilité faible");
    expect(ett({ vmaxIt: 2.9 })).toContain("Probabilité intermédiaire");
    expect(ett({ vmaxIt: 3.4 })).toContain("Probabilité intermédiaire");
    expect(ett({ vmaxIt: 3.5 })).toContain("Probabilité élevée");
  },
};

describe("inventaire des seuils", () => {
  it("chaque règle a un contrôle, et chaque contrôle une règle", () => {
    expect(Object.keys(verifs).sort()).toEqual(seuils.map((s) => s.id).sort());
  });
  it("les identifiants sont uniques et les mots de recherche renseignés", () => {
    expect(new Set(seuils.map((s) => s.id)).size).toBe(seuils.length);
    for (const s of seuils) {
      expect(s.motsEn.length, s.id).toBeGreaterThan(0);
      expect(s.motsFr.length, s.id).toBeGreaterThan(0);
    }
  });
  for (const s of seuils) it(`${s.id} : le code applique la règle décrite`, () => verifs[s.id]());
});

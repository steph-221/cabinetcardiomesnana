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
  });
});

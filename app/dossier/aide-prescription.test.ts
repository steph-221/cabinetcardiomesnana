import { describe, expect, it } from "vitest";
import { allergieConcernee } from "./cardio-medicaments";
import { composer, detecterSituations, type Contexte } from "./aide-prescription";
import { produitsParSubstance } from "./aide-prescription-produits";

const base: Contexte = { rubriques: [], taSys: null, taDia: null, fc: null, fevg: null, ldl: null, allergies: "", traitements: [] };
const cles = (c: Partial<Contexte>) => detecterSituations({ ...base, ...c }).map((s) => s.cle);

describe("situations détectées", () => {
  it("repère la fibrillation atriale et propose anticoagulation et fréquence", () => {
    const r = cles({ rubriques: [{ source: "conclusion", texte: "ACFA paroxystique, CHA2DS2-VASc à 3" }] });
    expect(r).toEqual(expect.arrayContaining(["fa-anticoag", "fa-frequence"]));
  });
  it("ignore les signes niés", () => {
    expect(cles({ rubriques: [{ source: "examen", texte: "Pas d'œdème des membres inférieurs. Absence d'angor." }] })).toEqual([]);
    expect(cles({ rubriques: [{ source: "examen", texte: "Sans douleur thoracique, ni palpitations" }] })).not.toContain("angor");
  });
  it("utilise les constantes et mesures", () => {
    expect(cles({ taSys: 152, taDia: 88 })).toEqual(["hta"]);
    expect(cles({ taSys: 128, taDia: 78 })).toEqual([]);
    expect(cles({ fevg: 35 })).toEqual(["ic-reduite"]);
    expect(cles({ ldl: 1.4 })).toEqual(["dyslipidemie"]);
  });
  it("ne confond pas hypertension artérielle et pulmonaire", () => {
    const r = cles({ rubriques: [{ source: "conclusion", texte: "Hypertension pulmonaire modérée" }] });
    expect(r).toContain("htap");
    expect(r).not.toContain("hta");
  });
});

describe("propositions", () => {
  it("donne posologie, produits liés à la fiche, traitement en cours et allergie", async () => {
    const detectees = detecterSituations({ ...base, rubriques: [{ source: "conclusion", texte: "FA permanente" }] });
    const s = composer(detectees, { allergies: "apixaban", traitements: ["BISOPROLOL 5 MG"] }, await produitsParSubstance(), allergieConcernee);
    const anticoag = s.find((x) => x.cle === "fa-anticoag")!;
    const rivaroxaban = anticoag.groupes.flatMap((g) => g.propositions).find((p) => p.dci === "rivaroxaban")!;
    expect(rivaroxaban.posologie).toMatch(/20 mg/);
    expect(rivaroxaban.produits.length).toBeGreaterThan(0);
    expect(rivaroxaban.produits.every((p) => p.url.startsWith("https://medicament.ma/medicament/"))).toBe(true);
    // Les associations (ex. périndopril + indapamide) ne sont pas proposées comme produit d'une seule substance
    const hta = composer(detecterSituations({ ...base, taSys: 160 }), base, await produitsParSubstance(), allergieConcernee);
    const iec = hta[0].groupes.find((g) => g.cle === "iec")!.propositions.flatMap((p) => p.produits);
    expect(iec.length).toBeGreaterThan(0);
    expect(iec.some((p) => /PRETERAX|TRITAZIDE|LISOR/i.test(p.nom))).toBe(false);
    expect(anticoag.groupes.flatMap((g) => g.propositions).find((p) => p.dci === "apixaban")!.allergie).toBe("apixaban");
    const freq = s.find((x) => x.cle === "fa-frequence")!;
    expect(freq.groupes.flatMap((g) => g.propositions).find((p) => p.dci === "bisoprolol")!.dejaPris).toBe(true);
  });
});

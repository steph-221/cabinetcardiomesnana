import { describe, expect, it } from "vitest";
import { decouperOrdonnance, lireOrdonnanceDictee } from "./ordonnance-dictee";

const ligne = (texte: string) => decouperOrdonnance(texte)[0];

describe("une ligne d'ordonnance dictée", () => {
  const cas: [string, string, string, string][] = [
    ["Bisoprolol 5 mg, un comprimé le matin, trois mois", "Bisoprolol 5 mg", "1 comprimé le matin", "3 mois"],
    ["bisoprolol 5 un comprimé le matin pendant 3 mois", "Bisoprolol 5", "1 comprimé le matin", "3 mois"],
    ["Kardégic 75 un sachet à midi 6 mois", "Kardégic 75", "1 sachet à midi", "6 mois"],
    ["Lasilix 40 mg un demi comprimé le matin 1 mois", "Lasilix 40 mg", "½ comprimé le matin", "1 mois"],
    ["Sintrom 4 mg un quart de comprimé le soir", "Sintrom 4 mg", "¼ de comprimé le soir", ""],
    ["amlodipine 5 mg le soir pendant trois mois", "Amlodipine 5 mg", "le soir", "3 mois"],
    ["atorvastatine 40 1 cp le soir 3 mois", "Atorvastatine 40", "1 cp le soir", "3 mois"],
    ["ramipril 2,5 mg 1 comprimé matin et soir 3 mois", "Ramipril 2,5 mg", "1 comprimé matin et soir", "3 mois"],
    ["Coversyl 5 mg 1 comprimé par jour au long cours", "Coversyl 5 mg", "1 comprimé par jour", "au long cours"],
    ["Xarelto 20 mg un comprimé le soir pendant le repas pour 6 mois", "Xarelto 20 mg", "1 comprimé le soir pendant le repas", "6 mois"],
    ["Cordarone 200 un comprimé par jour 5 jours sur 7 pendant 3 mois", "Cordarone 200", "1 comprimé par jour 5 jours sur 7", "3 mois"],
    ["Natispray deux bouffées si besoin", "Natispray", "2 bouffées si besoin", ""],
    ["Lovenox 0,4 ml une injection par jour pendant dix jours", "Lovenox 0,4 ml", "1 injection par jour", "10 jours"],
    ["1) Aldactone 25 mg 1 cp le matin 3 mois", "Aldactone 25 mg", "1 cp le matin", "3 mois"],
    ["Forxiga 10 mg, 1 comprimé le matin, qsp 3 mois.", "Forxiga 10 mg", "1 comprimé le matin", "3 mois"],
    ["Doliprane 1 g 1 comprimé 3 fois par jour si besoin 5 jours", "Doliprane 1 g", "1 comprimé 3 fois par jour si besoin", "5 jours"],
  ];
  for (const [dicte, medicament, posologie, duree] of cas) {
    it(dicte, () => {
      expect(ligne(dicte)).toEqual({ medicament, posologie, duree, douteux: false });
    });
  }

  it("ne prend pas une fréquence pour une durée", () => {
    expect(ligne("Fosamax 70 un comprimé tous les 7 jours")).toMatchObject({
      medicament: "Fosamax 70",
      posologie: "1 comprimé tous les 7 jours",
      duree: "",
    });
    expect(ligne("Cordarone 200 1 comprimé 1 jour sur 2")).toMatchObject({ posologie: "1 comprimé 1 jour sur 2", duree: "" });
  });

  it("signale une ligne sans posologie ou sans médicament", () => {
    expect(ligne("Bisoprolol 5 mg")).toEqual({ medicament: "Bisoprolol 5 mg", posologie: "", duree: "", douteux: true });
    expect(ligne("un comprimé le matin")).toMatchObject({ medicament: "", douteux: true });
  });
});

describe("plusieurs lignes", () => {
  it("sépare sur les retours à la ligne, les points, les points-virgules et « puis »", () => {
    const texte =
      "Bisoprolol 5 mg 1 cp le matin 3 mois\nKardégic 75 1 sachet à midi 3 mois. Atorvastatine 40 mg 1 cp le soir ; Lasilix 40 1 cp le matin puis Aldactone 25 1 cp le matin";
    expect(decouperOrdonnance(texte).map((l) => l.medicament)).toEqual([
      "Bisoprolol 5 mg",
      "Kardégic 75",
      "Atorvastatine 40 mg",
      "Lasilix 40",
      "Aldactone 25",
    ]);
  });

  it("ne coupe pas sur une virgule décimale ni sur un point décimal", () => {
    expect(decouperOrdonnance("Ramipril 2,5 mg 1 cp le matin. Lovenox 0.4 ml 1 injection par jour")).toHaveLength(2);
  });

  it("ignore les lignes vides", () => {
    expect(decouperOrdonnance("\n\n  \n")).toEqual([]);
  });
});

describe("depuis la dictée brute du navigateur", () => {
  it("applique les commandes dictées, le lexique et l'orthographe des médicaments", () => {
    const { lignes } = lireOrdonnanceDictee(
      "bisoprolole 5 mg virgule un comprimé le matin virgule trois mois à la ligne cardégic 75 un sachet à midi 3 mois",
      [{ entendu: "cardégic", correct: "Kardégic" }],
    );
    expect(lignes).toEqual([
      { medicament: "Bisoprolol 5 mg", posologie: "1 comprimé le matin", duree: "3 mois", douteux: false },
      { medicament: "Kardégic 75", posologie: "1 sachet à midi", duree: "3 mois", douteux: false },
    ]);
  });
});

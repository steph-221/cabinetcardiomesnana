import { describe, expect, it } from "vitest";
import { corrigerLocalement, corrigerTexte, insererFragment } from "./correction-locale";

describe("dictée de consultation (rangement par rubrique)", () => {
  it("range les rubriques annoncées et relève les valeurs", () => {
    const c = corrigerLocalement(
      "motif deux points contrôle sous sin trom à la ligne examen deux points RAS TA 13 8 fréquence cardiaque 62 à la ligne conclusion deux points bon équilibre tensionnel",
      [],
    );
    expect(c.rubriques.motif).toBe("Contrôle sous Sintrom");
    expect(c.rubriques.conclusion).toBe("Bon équilibre tensionnel");
    expect(c.valeurs).toMatchObject({ taSys: 130, taDia: 80, fc: 62 });
    expect(c.incertains).toEqual([{ entendu: "sin trom", propose: "Sintrom" }]);
  });
});

describe("texte dicté dans un champ libre", () => {
  it("applique la ponctuation dictée et met les majuscules", () => {
    expect(corrigerTexte("pas de douleur thoracique virgule dyspnée d'effort stade 2 point à la ligne œdèmes des membres inférieurs", []).texte).toBe(
      "Pas de douleur thoracique, dyspnée d'effort stade 2.\nŒdèmes des membres inférieurs",
    );
  });

  it("corrige les sigles, les médicaments et les mots du lexique", () => {
    const { texte, incertains } = corrigerTexte("f e v g à 55 pour cent sous bisoprolole et cardix", [
      { entendu: "cardix", correct: "Cardix" },
    ]);
    expect(texte).toBe("FEVG à 55 % sous bisoprolol et Cardix");
    expect(incertains).toEqual([{ entendu: "bisoprolole", propose: "bisoprolol" }]);
  });

  it("garde la minuscule au milieu d'une phrase, et la ponctuation du début", () => {
    expect(corrigerTexte("sans particularité", [], false).texte).toBe("sans particularité");
    expect(corrigerTexte("virgule sans particularité", [], false).texte).toBe(", sans particularité");
    expect(corrigerTexte("à la ligne deuxième élément", [], false).texte).toBe("\nDeuxième élément");
  });
});

describe("insertion à la position du curseur", () => {
  const inserer = (avant: string, apres: string, brut: string) => insererFragment(avant, apres, brut, []);

  it("commence par une majuscule dans un champ vide ou après un point", () => {
    expect(inserer("", "", "souffle systolique").valeur).toBe("Souffle systolique");
    expect(inserer("Pas d'angor.", "", "dyspnée d'effort").valeur).toBe("Pas d'angor. Dyspnée d'effort");
    expect(inserer("Pas d'angor.\n", "", "dyspnée d'effort").valeur).toBe("Pas d'angor.\nDyspnée d'effort");
  });

  it("ajoute l'espace qui manque et garde la minuscule au milieu d'une phrase", () => {
    const r = inserer("Souffle systolique", "", "au foyer aortique");
    expect(r.valeur).toBe("Souffle systolique au foyer aortique");
    expect(r.curseur).toBe(r.valeur.length);
  });

  it("colle la ponctuation au texte qui précède", () => {
    expect(inserer("Souffle systolique ", "", "virgule irradiant aux carotides").valeur).toBe(
      "Souffle systolique, irradiant aux carotides",
    );
    expect(inserer("Souffle systolique", "", "point à la ligne pas d'œdème").valeur).toBe("Souffle systolique.\nPas d'œdème");
  });

  it("insère au milieu d'un texte sans coller les mots", () => {
    const r = inserer("RVAo mécanique", "ACFA", "en 2019 virgule");
    expect(r.valeur).toBe("RVAo mécanique en 2019, ACFA");
    expect(r.curseur).toBe("RVAo mécanique en 2019, ".length);
  });

  it("ne change rien quand rien n'a été reconnu", () => {
    expect(inserer("Texte", " suite", "   ")).toMatchObject({ valeur: "Texte suite", curseur: 5, insere: "" });
  });
});

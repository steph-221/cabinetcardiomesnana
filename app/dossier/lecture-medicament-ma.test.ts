import { describe, expect, it } from "vitest";
import { differences, lectureSuspecte, lireFiche, lireListe } from "./lecture-medicament-ma";


describe("lecture de medicament.ma", () => {
  it("rejette une page sans structure de liste", () => {
    expect(lireListe("<html><body>Erreur</body></html>")).toBeNull();
  });
  it("lit une ligne de la liste", () => {
    const html = `<ul class="listing"><li class="listing-item"><a href="https://medicament.ma/medicament/x/"><p class="primary">ABC 5 MG, Comprimé</p><span class="secondary">Boite de 30 - PPV: 19.10 dhs - PH: 10.00 dhs - LABO SA </span></a></li></ul>`;
    expect(lireListe(html)).toEqual([
      { url: "https://medicament.ma/medicament/x/", nom: "ABC 5 MG, Comprimé", presentation: "Boite de 30", ppv: "19.10 dhs", ph: "10.00 dhs", labo: "LABO SA" },
    ]);
  });
  it("signale une fiche supprimée ou une structure modifiée", () => {
    expect(lireFiche('<h1 class="error-title">Page non trouvée</h1>')).toBe("introuvable");
    expect(lireFiche("<html><h1>Titre</h1></html>")).toBeNull();
  });
  it("décrit les différences et ignore les champs non relevés", () => {
    const avant = { nom: "A", presentation: "Boite de 30", ppv: "19.10 dhs", labo: "L" };
    expect(differences(avant, { ppv: "PPV: 19.10 dhs", presentation: "boite de  30" })).toEqual([]);
    expect(differences(avant, { ppv: "21.00 dhs", dci: "x" })).toEqual(["Prix (PPV) : « 19.10 dhs » → « 21.00 dhs »"]);
  });
  it("ne prend pas une lecture amputée pour des retraits", () => {
    expect(lectureSuspecte(500, 100)).toMatch(/100/);
    expect(lectureSuspecte(500, 480)).toBeNull();
    expect(lectureSuspecte(5, 0)).toBeNull();
  });
});

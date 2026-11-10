import { describe, expect, it } from "vitest";
import { correctionsApportees } from "./apprentissage-lexique";
import { ajouterJoursA, normaliserActions, trouverTraitement } from "./note-vocale";

describe("actions d'une note vocale", () => {
  const aujourdhui = "2026-11-10";

  it("garde les actions connues et borne les textes", () => {
    const actions = normaliserActions(
      [
        { type: "note", texte: "  Patient   fatigué  " },
        { type: "suivi", quoi: "Échocardiographie (ETT)", delaiJours: 182 },
        { type: "traitement", medicament: "Bisoprolol 5 mg", posologie: "1 cp le matin" },
        { type: "arret", medicament: "Cardix" },
        { type: "ordonnance", texte: "Kardégic 75 1 sachet à midi 3 mois" },
        { type: "supprimer_dossier" },
        { type: "note", texte: "" },
        null,
      ],
      aujourdhui,
    );
    expect(actions).toEqual([
      { type: "note", texte: "Patient fatigué" },
      { type: "suivi", quoi: "Échocardiographie (ETT)", echeance: "2027-05-11" },
      { type: "traitement", medicament: "Bisoprolol 5 mg", posologie: "1 cp le matin" },
      { type: "arret", medicament: "Cardix" },
      { type: "ordonnance", texte: "Kardégic 75 1 sachet à midi 3 mois" },
    ]);
  });

  it("préfère une date dictée, refuse une échéance passée ou invalide", () => {
    const suivi = (a: object) => normaliserActions([{ type: "suivi", quoi: "INR", ...a }], aujourdhui)[0];
    expect(suivi({ date: "2026-12-01", delaiJours: 7 })).toMatchObject({ echeance: "2026-12-01" });
    expect(suivi({ date: "2026-01-01" })).toMatchObject({ echeance: "" });
    expect(suivi({ date: "bientôt" })).toMatchObject({ echeance: "" });
    expect(suivi({ delaiJours: -3 })).toMatchObject({ echeance: "" });
  });

  it("n'accepte que des listes", () => {
    expect(normaliserActions("note", aujourdhui)).toEqual([]);
    expect(normaliserActions(null, aujourdhui)).toEqual([]);
  });

  it("calcule une échéance en passant les mois et les années", () => {
    expect(ajouterJoursA("2026-12-25", 10)).toBe("2027-01-04");
  });
});

describe("traitement à arrêter", () => {
  const traitements = [
    { id: 1, medicament: "Cardix 6,25 mg", fin: null },
    { id: 2, medicament: "Kardégic 75 mg", fin: null },
    { id: 3, medicament: "Kardégic 160 mg", fin: "2025-01-01" },
    { id: 4, medicament: "Bisoprolol 2,5 mg", fin: null },
    { id: 5, medicament: "Bisoprolol 5 mg", fin: null },
  ];
  it("retrouve le traitement en cours par son nom, sans tenir compte des accents", () => {
    expect(trouverTraitement(traitements, "le cardix")?.id).toBe(1);
    expect(trouverTraitement(traitements, "Kardegic")?.id).toBe(2);
  });
  it("ne choisit pas entre deux traitements possibles, ni un traitement inconnu", () => {
    expect(trouverTraitement(traitements, "bisoprolol")).toBeNull();
    expect(trouverTraitement(traitements, "Lasilix")).toBeNull();
    expect(trouverTraitement(traitements, "")).toBeNull();
  });
});

describe("corrections à proposer au lexique", () => {
  it("relève un mot remplacé à la main après la dictée", () => {
    expect(correctionsApportees("Patient sous cardix et sin trome depuis 2019", "Patient sous Cardix et Sintrom depuis 2019")).toEqual([
      { entendu: "sin trome", correct: "Sintrom" },
    ]);
  });
  it("ignore les ajouts, les suppressions, les valeurs corrigées et les réécritures", () => {
    expect(correctionsApportees("Souffle systolique", "Souffle systolique au foyer aortique")).toEqual([]);
    expect(correctionsApportees("Souffle systolique au foyer aortique", "Souffle systolique")).toEqual([]);
    expect(correctionsApportees("FEVG à 55 %", "FEVG à 45 %")).toEqual([]);
    expect(correctionsApportees("le patient va bien ce matin", "aucune plainte fonctionnelle rapportée à ce jour")).toEqual([]);
    expect(correctionsApportees("contrôle prévu ce matin au cabinet", "contrôle prévu ce soir au cabinet")).toEqual([]);
  });
  it("ne propose jamais de remplacer un nom protégé (médicament pris pour un autre)", () => {
    const proteges = new Set(["cardix"]);
    expect(correctionsApportees("sous Cardix depuis un an", "sous Cardil depuis un an", 5, proteges)).toEqual([]);
    expect(correctionsApportees("sous Cardix depuis un an", "sous Cardil depuis un an")).toEqual([{ entendu: "Cardix", correct: "Cardil" }]);
  });
  it("ignore un simple changement de majuscule ou d'accent", () => {
    expect(correctionsApportees("oedeme des membres", "Œdème des membres")).toEqual([{ entendu: "oedeme", correct: "Œdème" }]);
    expect(correctionsApportees("kardegic 75", "Kardégic 75")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  ajouterJours,
  civilite,
  composerCertificat,
  enLettres,
  finDePeriode,
  idModelePerso,
  modeleDepuisPerso,
  modeles,
  titreCertificat,
  trouverModeleCertificat,
  valeursInitiales,
  type ContexteCertificat,
} from "./certificats-modeles";

const ctx: ContexteCertificat = {
  patient: { nom: "El Makoudi", prenom: "Mohamed", sexe: "M", naissance: "1997-08-03" },
  date: "2026-11-11",
  medecin: "Dr Taouab Zogarh Cursoux",
  ville: "Tanger",
};
const modele = (cle: string) => trouverModeleCertificat(cle)!;

describe("dates", () => {
  it("la fin d'une période est inclusive", () => {
    expect(finDePeriode("2026-11-01", 3)).toBe("2026-11-03");
    expect(finDePeriode("2026-12-30", 3)).toBe("2027-01-01");
    expect(finDePeriode("2026-01-31", 1, "mois")).toBe("2026-02-27");
    expect(finDePeriode("2026-11-01", 0)).toBe("");
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
  });
  it("nombres en lettres", () => {
    expect([0, 5, 17, 21, 31, 71, 80, 91, 99].map(enLettres)).toEqual([
      "zéro", "cinq", "dix-sept", "vingt et un", "trente et un", "soixante et onze", "quatre-vingts", "quatre-vingt-onze", "quatre-vingt-dix-neuf",
    ]);
  });
});

describe("civilité et accords", () => {
  it("enfant de moins de 15 ans, sinon M. / Mme", () => {
    expect(civilite({ ...ctx.patient, naissance: "2020-01-01" }, ctx.date)).toBe("Enfant");
    expect(civilite({ ...ctx.patient, sexe: "F" }, ctx.date)).toBe("Mme");
    expect(civilite({ ...ctx.patient, sexe: "" }, ctx.date)).toBe("M./Mme");
  });
});

describe("composerCertificat", () => {
  it("entoure le corps de l'en-tête et du pied de page légaux", () => {
    const t = composerCertificat(modele("bonne-sante"), {}, ctx);
    expect(t).toContain("Je soussigné, Dr Taouab Zogarh Cursoux, certifie avoir examiné ce jour, le 11 novembre 2026, M. EL MAKOUDI Mohamed, né le 03/08/1997.");
    expect(t).toContain("Il ne présente, à l'examen clinique de ce jour, aucun signe apparent d'affection évolutive ou contagieuse.");
    expect(t).toContain("Fait à Tanger, le 11/11/2026.");
    expect(t).toContain("Certificat rédigé à la demande de l'intéressé et remis en mains propres");
  });
  it("accorde au féminin", () => {
    const t = composerCertificat(modele("non-contagion"), { retour: "2026-11-15" }, { ...ctx, patient: { ...ctx.patient, sexe: "F" } });
    expect(t).toContain("née le");
    expect(t).toContain("Elle est à ce jour guérie et indemne");
    expect(t).toContain("à compter du 15/11/2026");
  });
  it("arrêt de travail : date de fin calculée", () => {
    const t = composerCertificat(modele("arret-travail"), { jours: "3", debut: "2026-11-11", sorties: "Non" }, ctx);
    expect(t).toContain("d'une durée de 3 jours, à compter de ce jour, du 11/11/2026 au 13/11/2026 inclus. Sorties autorisées : Non.");
  });
  it("champ manquant : points de suspension, jamais « undefined »", () => {
    for (const m of modeles) expect(composerCertificat(m, valeursInitiales(m, ctx.date), ctx)).not.toMatch(/undefined|NaN/);
    expect(composerCertificat(modele("concours"), {}, ctx)).toContain("du concours de ……");
  });
  it("sport : l'ECG est mentionné seulement s'il est coché", () => {
    expect(composerCertificat(modele("sport"), { sport: "football", ecg: "Oui" }, ctx)).toContain(
      "et au vu de l'électrocardiogramme de repos, aucune contre-indication apparente à la pratique de football en compétition",
    );
    expect(composerCertificat(modele("sport"), { sport: "football", ecg: "Non" }, ctx)).not.toContain("électrocardiogramme");
  });
  it("coups et blessures : lésions en liste, ITT en lettres et en chiffres", () => {
    const t = composerCertificat(modele("coups-blessures"), { nature: "agression", dateFaits: "2026-11-10", heure: "21 h", lesions: "Ecchymose 3 cm, bleue, bras droit\nPlaie 2 cm, front", itt: "5" }, ctx);
    expect(t).toContain("victime d'une agression le 10/11/2026 à 21 h.");
    expect(t).toContain("- Ecchymose 3 cm, bleue, bras droit\n- Plaie 2 cm, front");
    expect(t).toContain("ITT) au sens pénal de cinq (5) jours");
  });
  it("enfant malade : père ou mère", () => {
    const base = { enfant: "Sara Alami", jours: "2", debut: "2026-11-11" };
    expect(composerCertificat(modele("enfant-malade"), { ...base, parent: "père" }, ctx)).toContain("de son père à son chevet");
    expect(composerCertificat(modele("enfant-malade"), { ...base, parent: "mère" }, ctx)).toContain("de sa mère à son chevet");
  });
  it("les clés des modèles sont uniques", () => {
    expect(new Set(modeles.map((m) => m.cle)).size).toBe(modeles.length);
    expect(modeles.length).toBe(17);
  });
});

describe("modèles personnels", () => {
  const perso = { id: 7, libelle: "Contre-indication au sport", texte: "Ne présente aucune contre-indication à …… ." };

  it("devient un modèle « Mes modèles » avec le texte prérempli", () => {
    const m = modeleDepuisPerso(perso);
    expect(m.cle).toBe("perso:7");
    expect(m.groupe).toBe("Mes modèles");
    expect(valeursInitiales(m, "2026-11-11").texte).toBe(perso.texte);
  });

  it("garde l'en-tête légal et la formule finale automatiques", () => {
    const m = modeleDepuisPerso(perso);
    const texte = composerCertificat(m, valeursInitiales(m, ctx.date), ctx);
    expect(texte).toContain("Je soussigné, Dr Taouab Zogarh Cursoux, certifie avoir examiné");
    expect(texte).toContain("Ne présente aucune contre-indication");
    expect(texte).toContain("Fait à Tanger");
  });

  it("reconnaît la clé d'un modèle personnel", () => {
    expect(idModelePerso("perso:7")).toBe(7);
    expect(idModelePerso("libre")).toBeNull();
    expect(idModelePerso("perso:abc")).toBeNull();
  });

  it("le titre vient du nom enregistré avec le certificat, même si le modèle est supprimé", () => {
    expect(titreCertificat("perso:7", { _libelle: "Contre-indication au sport" })).toBe("Contre-indication au sport");
    expect(titreCertificat("perso:7", {})).toBe("Certificat personnalisé");
    expect(titreCertificat("libre")).toBe("Certificat libre");
  });
});

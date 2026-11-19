import { describe, expect, it } from "vitest";
import { formuleAppel, objetCourrier, texteCourrier, type DonneesCourrier } from "./courrier";

const base: DonneesCourrier = {
  confrere: "Dr Alami",
  patient: { nom: "Bennani", prenom: "Salma", sexe: "F", age: 64 },
  date: "2026-11-10",
  motif: "contrôle sous AVK",
  antecedents: "RVAo mécanique (2019), ACFA",
  traitements: ["Sintrom 4 mg 1/4 cp le soir", "Bisoprolol 5 mg 1 cp le matin"],
  examen: "RAS",
  ecg: "Rythme sinusal 62 bpm",
  autres: "",
  conclusion: "Bon équilibre, INR 2,8",
  conduite: "Continuer le traitement, contrôle dans 3 mois",
  constantes: "TA 130/80 mmHg, FC 62 bpm",
};

describe("courrier au confrère", () => {
  it("reprend la consultation, rubrique par rubrique", () => {
    const t = texteCourrier(base);
    expect(t).toContain("Cher confrère, cher Docteur Alami,");
    expect(t).toContain("J'ai revu Madame Salma BENNANI, âgée de 64 ans, en consultation de cardiologie le 10/11/2026 pour : contrôle sous AVK.");
    expect(t).toContain("Traitement en cours : Sintrom 4 mg 1/4 cp le soir ; Bisoprolol 5 mg 1 cp le matin.");
    expect(t).toContain("À l'examen : TA 130/80 mmHg, FC 62 bpm. RAS");
    expect(t).toContain("En conclusion : Bon équilibre, INR 2,8");
    expect(t.endsWith("Confraternellement,")).toBe(true);
  });
  it("omet les rubriques vides et n'invente rien", () => {
    const t = texteCourrier({ ...base, antecedents: "", traitements: [], ecg: "", conduite: "", conclusion: "", examen: "", constantes: "" });
    expect(t).not.toMatch(/Antécédents|Traitement en cours|ECG|Conduite|En conclusion|À l'examen/);
    expect(t).toContain("J'ai revu");
  });
  it("s'adapte au sexe, à l'âge inconnu et au confrère inconnu", () => {
    const t = texteCourrier({ ...base, confrere: "", patient: { nom: "Idrissi", prenom: "", sexe: "M", age: null } });
    expect(t).toContain("Cher confrère, chère consœur,");
    expect(t).toContain("J'ai revu Monsieur IDRISSI, en consultation");
    expect(formuleAppel("Pr Tazi")).toBe("Cher confrère, cher Pr Tazi,");
  });
  it("fait un objet clair", () => {
    expect(objetCourrier({ nom: "Bennani", prenom: "Salma" }, "2026-11-10")).toBe("Objet : Salma BENNANI — consultation de cardiologie du 10/11/2026");
  });
});

describe("PDF du courrier", () => {
  it("génère un vrai PDF avec accents et paragraphes", async () => {
    const { pdfCourrier } = await import("./pdf");
    const pdf = await pdfCourrier({
      date: "2026-11-10",
      destinataire: "Dr Alami",
      objet: objetCourrier({ nom: "Bennani", prenom: "Salma" }, "2026-11-10"),
      texte: texteCourrier(base),
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });
});

import { describe, expect, it } from "vitest";
import { consultationDemandee, libelleConsultation, lireChoixConsultation } from "./choix-consultation";

const options = [
  { id: 12, date: "2026-11-04", motif: "Contrôle INR" },
  { id: 9, date: "2026-09-25", motif: "" },
];

describe("lireChoixConsultation", () => {
  it("vide ou absent : automatique", () => {
    expect(lireChoixConsultation("")).toBeUndefined();
    expect(lireChoixConsultation(null)).toBeUndefined();
    expect(lireChoixConsultation(undefined)).toBeUndefined();
  });
  it("« aucune » : aucun rattachement", () => {
    expect(lireChoixConsultation("aucune")).toBeNull();
  });
  it("un numéro de consultation", () => {
    expect(lireChoixConsultation("12")).toBe(12);
    expect(lireChoixConsultation(" 7 ")).toBe(7);
  });
  it("tout le reste est refusé (automatique), jamais un numéro approximatif", () => {
    for (const mauvais of ["0", "-3", "1.5", "12abc", "abc", "1e3", "99999999999", new File([], "x")]) {
      expect(lireChoixConsultation(mauvais)).toBeUndefined();
    }
  });
});

describe("consultationDemandee", () => {
  it("retient une consultation du patient et ignore les autres", () => {
    expect(consultationDemandee("12", options)).toBe(12);
    expect(consultationDemandee(["9", "12"], options)).toBe(9);
    expect(consultationDemandee("77", options)).toBeUndefined();
    expect(consultationDemandee("aucune", options)).toBeUndefined();
    expect(consultationDemandee(undefined, options)).toBeUndefined();
  });
});

describe("libelleConsultation", () => {
  it("date au format français, motif s'il existe", () => {
    expect(libelleConsultation(options[0])).toBe("04/11/2026 — Contrôle INR");
    expect(libelleConsultation(options[1])).toBe("25/09/2026");
  });
});

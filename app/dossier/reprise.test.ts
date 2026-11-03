import { describe, expect, it } from "vitest";
import { dateFrancaise, identiteLocale } from "./reprise";

describe("dateFrancaise", () => {
  it("accepte des espaces autour des séparateurs (« 07/09 /2026 »)", () => {
    expect(dateFrancaise("07/09 /2026")).toBe("2026-09-07");
    expect(dateFrancaise("08 /06/2026")).toBe("2026-06-08");
  });
  it("refuse une date qui n'existe pas", () => expect(dateFrancaise("31/02/2026")).toBeNull());
});

describe("identiteLocale sur les modèles du cabinet", () => {
  it("rapport de consultation : date écrite avec un espace avant la barre", () => {
    const t = "DATE :08 /06/2026\nNOM : PRENOM : | sofia benali\nDATE DE NAISSANCE : | 04/05/1970";
    const i = identiteLocale(t, "cs sofia benali.docx");
    expect(i).toMatchObject({ nom: "Sofia", prenom: "Benali", naissance: "1970-05-04", dateDocument: "2026-06-08" });
  });
  it("rapport de consultation : l'âge écrit à la place de la date de naissance", () => {
    const t = "DATE : 04/09/2026\nNOM : PRENOM : | Karim Alaoui\nDATE DE NAISSANCE : | 90 ans";
    const i = identiteLocale(t, "karim alaoui cst (2).docx");
    expect(i.naissance).toBeNull();
    expect(i.age).toBe(90);
    expect(i.dateDocument).toBe("2026-09-04");
  });
  it("ETT : date avec espace, âge, date sans deux-points", () => {
    expect(identiteLocale("Malade : LAILA IDRISSI Age : 47 ans Date : 07/09 /2026", "LAILA IDRISSI  ETT 3.docx")).toMatchObject({
      age: 47,
      dateDocument: "2026-09-07",
    });
    expect(identiteLocale("Malade : el fassi omar age : 65 ans Date 01/09/2026", "x.docx")).toMatchObject({
      age: 65,
      dateDocument: "2026-09-01",
    });
  });
  it("ETO : « Nom : » et « Prénom : » sur deux lignes", () => {
    const t = "Nom : TAZI\nPrénom : Hamid\nDate : 13/08/2025";
    expect(identiteLocale(t, "tazi hamid.doc")).toMatchObject({
      nom: "Tazi",
      prenom: "Hamid",
      dateDocument: "2025-08-13",
    });
  });
});

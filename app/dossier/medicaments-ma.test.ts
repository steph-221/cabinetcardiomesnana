import { describe, expect, it } from "vitest";
import { chercherMedicaments } from "./medicaments-ma";

describe("recherche medicament.ma", () => {
  it("trouve par nom commercial, avec lien vers la fiche", async () => {
    const r = await chercherMedicaments("bisoprolol");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].url).toMatch(/^https:\/\/medicament\.ma\/medicament\//);
    expect(r[0].dci).toBeTruthy();
  });
  it("trouve par substance et ignore accents et casse", async () => {
    const r = await chercherMedicaments("RIVAROXABAN 20");
    expect(r.some((m) => /rivaroxaban/i.test(m.dci))).toBe(true);
  });
  it("ignore les saisies trop courtes", async () => {
    expect(await chercherMedicaments("a")).toEqual([]);
  });
});

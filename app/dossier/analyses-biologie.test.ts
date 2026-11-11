import { describe, expect, it } from "vitest";
import { analysesValides, bilans, catalogue, toutesLesAnalyses } from "./analyses-biologie";

describe("analyses biologiques", () => {
  it("aucune analyse en double dans le catalogue", () => {
    expect(new Set(toutesLesAnalyses).size).toBe(toutesLesAnalyses.length);
  });
  it("chaque bilan ne contient que des analyses du catalogue", () => {
    for (const b of bilans) for (const a of b.analyses) expect(toutesLesAnalyses, `${b.titre} : ${a}`).toContain(a);
  });
  it("seules les analyses connues sont retenues, dans l'ordre du catalogue", () => {
    expect(analysesValides(["TSH", "n'importe quoi", "NFS", "NFS"])).toEqual(["NFS", "TSH"]);
    expect(catalogue.length).toBeGreaterThan(5);
  });
});

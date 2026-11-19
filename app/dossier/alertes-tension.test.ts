import { describe, expect, it } from "vitest";
import { alertes } from "./calculs";

const avec = (taSys: number, taDia: number) =>
  alertes({
    releves: [{ date: "2026-11-11", taSys, taDia, fc: null, mesures: {} }],
    traitementsEnCours: [],
    inrMin: null,
    inrMax: null,
    age: 56,
    sexe: "F",
  });

describe("alerte de tension", () => {
  it("dit que c'est la diastolique qui est élevée pour 122/94", () => {
    const [a] = avec(122, 94);
    expect(a.texte).toBe("TA 122/94 mmHg le 11/11/2026 : diastolique ≥ 90");
    expect(a.niveau).toBe("attention");
  });
  it("dit que c'est la systolique pour 150/80", () => {
    expect(avec(150, 80)[0].texte).toContain("systolique ≥ 140");
    expect(avec(150, 80)[0].texte).not.toContain("diastolique");
  });
  it("cite les deux quand les deux dépassent, et passe en critique à 180/110", () => {
    expect(avec(160, 100)[0].texte).toContain("systolique ≥ 140 et diastolique ≥ 90");
    expect(avec(185, 100)[0].niveau).toBe("critique");
  });
  it("ne dit rien pour une tension normale", () => {
    expect(avec(125, 80)).toEqual([]);
  });
});

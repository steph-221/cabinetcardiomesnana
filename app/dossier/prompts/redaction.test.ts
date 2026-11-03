import { describe, expect, it } from "vitest";
import { typesExamen } from "../examens";
import { calculsETT } from "../ett";
import { exemples, SEPARATEUR_VERIFICATIONS } from "./exemples";
import { modeles } from "./modeles";
import { promptRedaction, separerVerifications } from "./redaction";

describe("prompt de rédaction", () => {
  const prompt = promptRedaction({ medecin: "Dr Test", ville: "Casablanca" });

  it("contient le rôle, les règles, les modèles et les exemples", () => {
    for (const t of ["# RÔLE", "# RÈGLES DE FOND", "# RAISONNEMENT DIAGNOSTIQUE", "# MODÈLES DU CABINET", "# EXEMPLES"]) {
      expect(prompt).toContain(t);
    }
    expect(prompt).toContain("Dr Test");
  });

  it("a un modèle pour chaque examen qui se rédige", () => {
    for (const t of typesExamen.filter((t) => !["Compte rendu", "Ordonnance", "Autre"].includes(t))) {
      expect(modeles[t], t).toBeDefined();
    }
  });

  it("chaque exemple a au plus 5 points à vérifier et un modèle", () => {
    for (const e of exemples) {
      expect(modeles[e.type], e.type).toBeDefined();
      expect(e.verifier.length).toBeLessThanOrEqual(5);
    }
  });

  it("ajoute les références quand il y en a", () => {
    const avec = promptRedaction({ medecin: "Dr Test", ville: "Fès", references: [{ titre: "ESC 2021", page: 12, texte: "FEVG ≤ 40 %" }] });
    expect(avec).toContain('<reference id="R1" titre="ESC 2021 — p. 12">');
    expect(prompt).not.toContain("# RÉFÉRENCES");
  });

  it("sépare le compte rendu des points à vérifier", () => {
    const r = separerVerifications(`COMPTE RENDU\n- a\n\n${SEPARATEUR_VERIFICATIONS}\n- une\n- deux`);
    expect(r.compteRendu).toBe("COMPTE RENDU\n- a");
    expect(r.verifications).toEqual(["une", "deux"]);
    expect(separerVerifications(`CR\n${SEPARATEUR_VERIFICATIONS}\nRien à signaler`).verifications).toEqual([]);
  });
});

describe("chiffres de l'exemple d'ETT", () => {
  it("masse VG 181 g, épaisseur relative 0,52, PAPS 34", () => {
    const c = calculsETT({
      poids: null,
      taille: null,
      valeurs: { dtd: 46, siv: 10, pp: 12, vmaxIt: 2.8, pod: 3 },
    });
    expect(Math.round(c.masseVG!)).toBe(181);
    expect(c.epaisseurRelative!.toFixed(2)).toBe("0.52");
    expect(Math.round(c.paps!)).toBe(34);
  });
});

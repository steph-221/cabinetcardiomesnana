import { describe, expect, it } from "vitest";
import { ongletsDisponibles, ongletValide } from "./onglets-patient";

describe("onglets de la fiche patient", () => {
  it("le médecin a tous les onglets, l'aperçu en premier", () => {
    expect(ongletsDisponibles(true).map((o) => o.cle)).toEqual([
      "apercu",
      "consultations",
      "evolution",
      "examens",
      "documents",
      "fiche",
    ]);
  });

  it("la secrétaire n'a pas les onglets médicaux", () => {
    expect(ongletsDisponibles(false).map((o) => o.cle)).toEqual(["apercu", "examens", "documents", "fiche"]);
  });

  it("un onglet inconnu ou interdit ramène à l'aperçu", () => {
    expect(ongletValide("consultations", true)).toBe("consultations");
    expect(ongletValide("consultations", false)).toBe("apercu");
    expect(ongletValide("n'importe quoi", true)).toBe("apercu");
    expect(ongletValide(undefined, true)).toBe("apercu");
    expect(ongletValide(["examens", "fiche"], true)).toBe("examens");
  });
});

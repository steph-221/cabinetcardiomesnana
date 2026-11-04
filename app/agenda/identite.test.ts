import { describe, expect, it } from "vitest";
import { nomComplet, nomDepuisTitre, paramsPrefill, titreRendezvous } from "./identite";

describe("identité dans l'agenda", () => {
  it("assemble prénom et nom, avec ou sans prénom", () => {
    expect(nomComplet("Salma", "Alaoui")).toBe("Salma Alaoui");
    expect(nomComplet("", "Alaoui")).toBe("Alaoui");
    expect(titreRendezvous("Salma", "Alaoui", false)).toBe("RDV — Salma Alaoui");
    expect(titreRendezvous(undefined, "Alaoui", true)).toBe("Contrôle — Alaoui");
  });
  it("retrouve le nom d'un ancien rendez-vous depuis son titre", () => {
    expect(nomDepuisTitre("RDV — Salma Alaoui")).toBe("Salma Alaoui");
    expect(nomDepuisTitre("Contrôle — Alaoui")).toBe("Alaoui");
    expect(nomDepuisTitre("(sans titre)")).toBe("(sans titre)");
  });
  it("n'envoie que les champs remplis", () => {
    const p = paramsPrefill({ nom: "Alaoui", prenom: "Salma", telephone: "", dateNaissance: "1980-02-03" });
    expect(p.toString()).toBe("nom=Alaoui&prenom=Salma&naissance=1980-02-03");
  });
});

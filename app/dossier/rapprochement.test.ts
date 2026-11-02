import { describe, expect, it } from "vitest";
import { patientsCites } from "./rapprochement";

const patients = [
  { id: 1, nom: "Mouden", prenom: "Salman" },
  { id: 2, nom: "Khfif", prenom: "Farida" },
  { id: 3, nom: "Ali", prenom: "Ahmed" },
  { id: 4, nom: "Ben Ali", prenom: "Ahmed" },
  { id: 5, nom: "Mouden", prenom: "Hind" },
];

describe("patientsCites", () => {
  it("trouve le patient quel que soit l'ordre, les accents ou la casse", () => {
    const r = patientsCites("Vos résultats : analyses de MOUDEN SALMAN.", patients);
    expect(r.surs).toEqual([1]);
    expect(r.possibles).toEqual([5]);
    expect(patientsCites("RESULTAT salman_mouden.pdf", patients).surs).toEqual([1]);
  });
  it("deux dossiers possibles : aucun n'est écarté", () => {
    expect(patientsCites("analyses de BEN ALI AHMED", patients).surs).toEqual([3, 4]);
  });
  it("nom inconnu : rien", () => {
    expect(patientsCites("analyses de DUPONT JEAN", patients)).toEqual({ surs: [], possibles: [] });
  });
});

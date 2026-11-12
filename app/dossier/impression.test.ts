import { describe, expect, it } from "vitest";
import { lireImpression, paramsImpression, impressionParDefaut } from "./impression";
import { pdfCertificat, pdfOrdonnance } from "./pdf";
import type { Patient } from "./patients";

const patient = { id: 1, nom: "ATLAS", prenom: "Hanan", sexe: "F", naissance: "1970-03-29" } as Patient;
const ordonnance = { date: "2026-11-12", lignes: [{ medicament: "Bisoprolol 5 mg", posologie: "1 cp", duree: "3 mois" }], remarque: "" };

// Taille de page (points PDF) lue dans le PDF généré
const pages = (pdf: Buffer) => [...pdf.toString("latin1").matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map((m) => [Math.round(+m[1]), Math.round(+m[2])]);

describe("options d'impression", () => {
  it("A5 avec en-tête par défaut, A4 et sans en-tête sur demande", () => {
    expect(lireImpression(null, null)).toEqual(impressionParDefaut);
    expect(lireImpression("A4", "0")).toEqual({ format: "A4", entete: false });
    expect(lireImpression("A3", "x")).toEqual({ format: "A5", entete: true });
    expect(paramsImpression({ format: "A4", entete: false })).toBe("format=A4&entete=0");
  });

  it("l'ordonnance sort dans le format demandé", async () => {
    expect(pages(await pdfOrdonnance(ordonnance, patient))[0]).toEqual([420, 595]);
    expect(pages(await pdfOrdonnance(ordonnance, patient, { format: "A4", entete: true }))[0]).toEqual([595, 842]);
  });

  it("sans en-tête, le PDF est généré aussi (ordonnance et certificat)", async () => {
    const avec = await pdfOrdonnance(ordonnance, patient, { format: "A5", entete: true });
    const sans = await pdfOrdonnance(ordonnance, patient, { format: "A5", entete: false });
    expect(sans.length).toBeLessThan(avec.length);
    const c = { date: "2026-11-12", modele: "libre", texte: "Je soussigné certifie que le patient va bien." };
    expect(pages(await pdfCertificat(c, patient, { format: "A4", entete: false }))[0]).toEqual([595, 842]);
  });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adresseImpression, copieArchive, impressionParDefaut, libelleImpression, lireImpression, paramsImpression, type OptionsImpression } from "./impression";
import { pdfCertificat, pdfCompteRendu, pdfConsultation, pdfCourrier, pdfETT, pdfFacture, pdfOrdonnance } from "./pdf";
import type { Consultation } from "./consultations";
import type { DonneesExamen } from "./comptes-rendus/types";
import type { DonneesETT } from "./ett";
import type { Facture } from "./compta";
import type { Patient } from "./patients";

// Patient et documents fictifs, complets comme en consultation
const patient = {
  id: 1,
  nom: "ATLAS",
  prenom: "Hanan",
  sexe: "F",
  naissance: "1970-03-29",
  cin: "AB123456",
  facteursRisque: ["HTA", "dyslipidémie"],
  antecedents: "Fibrillation atriale paroxystique",
  allergies: "",
} as unknown as Patient;

const ordonnance = {
  date: "2026-11-12",
  lignes: [
    { medicament: "Bisoprolol 5 mg", posologie: "1 comprimé le matin", duree: "3 mois" },
    { medicament: "Apixaban 5 mg", posologie: "1 comprimé matin et soir", duree: "3 mois" },
    { medicament: "Atorvastatine 20 mg", posologie: "1 comprimé le soir", duree: "3 mois" },
  ],
  remarque: "Contrôle tensionnel à domicile.",
  examens: "Holter ECG de 24 heures.",
};

const certificat = {
  date: "2026-11-12",
  modele: "libre",
  texte:
    "Je soussigné, Docteur Mesnana, certifie avoir examiné ce jour Madame Hanan ATLAS.\n\nSon état de santé ne contre-indique pas la pratique du sport en loisir.\n\nCertificat établi à la demande de l'intéressée et remis en main propre pour servir et valoir ce que de droit.",
};

const courrier = {
  date: "2026-11-12",
  destinataire: "Dr Alami, médecin traitant",
  objet: "Objet : Hanan ATLAS — consultation de cardiologie du 12/11/2026",
  texte:
    "Cher confrère,\n\nJ'ai vu en consultation votre patiente pour des palpitations. L'examen est normal, la TA à 128/76 mmHg.\n\nJe vous propose de poursuivre le traitement actuel. Bien confraternellement.",
};

const consultation = {
  id: 1,
  date: "2026-11-12",
  motif: "Palpitations à l'effort",
  taSys: 128,
  taDia: 76,
  fc: 68,
  spo2: 98,
  poids: 64,
  taille: 165,
  examen: "Bruits du cœur réguliers, pas de souffle. Pas de signe d'insuffisance cardiaque.",
  ecg: "Rythme sinusal à 68 bpm, PR 160 ms, QRS fins, repolarisation normale.",
  echo: "FEVG 62 %, pas de valvulopathie significative.",
  mesures: {},
  autres: "",
  conclusion: "Palpitations bénignes. FA paroxystique sous anticoagulant, sans récidive.",
  conduite: "Poursuite du traitement. Holter ECG de contrôle. Revoir dans 6 mois.",
  creePar: "medecin",
  modifiePar: "medecin",
} as unknown as Consultation;

const ett = {
  indication: "Bilan de palpitations",
  operateur: "Dr Mesnana",
  poids: 64,
  taille: 165,
  valeurs: { ao: 31, ogDiam: 38, siv: 9, pp: 9, dtd: 47, dts: 29, fevg: 62, cinetique: "correcte", tapse: 22, mitrale: "fines", eMitral: 0.8, aortique: "fines", vmaxAo: 1.2 },
  total: "Échocardiographie normale. FEVG conservée à 62 %.",
} as DonneesETT;

const ecg = {
  modele: "ecg",
  indication: "Palpitations",
  operateur: "Dr Mesnana",
  age: 56,
  sexe: "F",
  valeurs: { rythme: "sinusal régulier", fc: 68, axe: 45, pr: 160, qrs: 90, qt: 400, repolarisation: "repolarisation normale" },
  total: "ECG normal.",
} as unknown as DonneesExamen;

const facture = {
  numero: "2026-0001",
  date: "2026-11-12",
  patientNom: "Hanan ATLAS",
  praticienNom: "Dr Mesnana",
  lignes: [
    { libelle: "Consultation de cardiologie", quantite: 1, prixCts: 40000 },
    { libelle: "Échocardiographie-Doppler", quantite: 1, prixCts: 80000 },
  ],
  remiseCts: 0,
  totalCts: 120000,
  payeCts: 0,
  annulee: false,
  note: "",
} as unknown as Facture;

const A5 = [420, 595];
const A4 = [595, 842];

// Tailles de page (points PDF) lues dans le PDF généré
const pages = (pdf: Buffer) =>
  [...pdf.toString("latin1").matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map((m) => [Math.round(+m[1]), Math.round(+m[2])]);

describe("options d'impression", () => {
  it("A5 sans en-tête par défaut : l'en-tête n'est imprimé que sur demande", () => {
    expect(impressionParDefaut).toEqual({ format: "A5", entete: false });
    expect(lireImpression(null, null)).toEqual(impressionParDefaut);
    expect(lireImpression("A4", "1")).toEqual({ format: "A4", entete: true });
    expect(lireImpression("A3", "x")).toEqual({ format: "A5", entete: false });
    expect(lireImpression("A5", "0")).toEqual({ format: "A5", entete: false });
    expect(paramsImpression({ format: "A4", entete: false })).toBe("format=A4&entete=0");
    expect(adresseImpression("/api/ordonnances/3/pdf", impressionParDefaut)).toBe("/api/ordonnances/3/pdf?format=A5&entete=0");
    expect(adresseImpression("/x?a=1", { format: "A4", entete: true })).toBe("/x?a=1&format=A4&entete=1");
  });

  it("la copie rangée dans Drive garde l'en-tête", () => {
    expect(copieArchive()).toEqual({ format: "A5", entete: true });
    expect(copieArchive("A4")).toEqual({ format: "A4", entete: true });
  });
});

const documents: [string, (o?: OptionsImpression) => Promise<Buffer>][] = [
  ["ordonnance", (o) => pdfOrdonnance(ordonnance, patient, o)],
  ["prescription d'analyses", (o) => pdfOrdonnance({ ...ordonnance, type: "biologie", lignes: [{ medicament: "NFS", posologie: "", duree: "" }, { medicament: "Créatinine", posologie: "", duree: "" }], examens: "" }, patient, o)],
  ["certificat", (o) => pdfCertificat(certificat, patient, o)],
  ["courrier", (o) => pdfCourrier(courrier, o)],
  ["rapport de consultation", (o) => pdfConsultation(consultation, patient, ["Bisoprolol 5 mg — 1 cp le matin"], undefined, o)],
  ["compte rendu d'ETT", (o) => pdfETT(ett, "2026-11-12", patient, o)],
  ["compte rendu d'ECG", (o) => pdfCompteRendu(ecg, "2026-11-12", patient, o)],
  ["facture", (o) => pdfFacture(facture, [], patient, o)],
];

describe("tous les documents sortent en A5 sans en-tête par défaut, A4 ou en-tête sur demande", () => {
  for (const [nom, generer] of documents) {
    it(nom, async () => {
      const parDefaut = await generer();
      expect(pages(parDefaut)[0]).toEqual(A5);
      // Sans en-tête, ni le bloc du cabinet ni le pied de page : le PDF est plus léger
      expect(parDefaut.length).toBeLessThan((await generer({ format: "A5", entete: true })).length);
      expect(pages(await generer({ format: "A4", entete: false }))[0]).toEqual(A4);
      expect(pages(await generer({ format: "A4", entete: true }))[0]).toEqual(A4);
    });
  }
});

// Contrôle visuel : ECHANTILLONS_PDF=<dossier> npx vitest run app/dossier/impression.test.ts
// enregistre chaque document dans les quatre présentations, à ouvrir ou à imprimer pour vérifier la mise en page.
const dossier = process.env.ECHANTILLONS_PDF;
describe.runIf(dossier)("échantillons à vérifier à l'œil", () => {
  it("enregistre les PDF", async () => {
    mkdirSync(dossier!, { recursive: true });
    const choix: OptionsImpression[] = [impressionParDefaut, { format: "A5", entete: true }, { format: "A4", entete: false }, { format: "A4", entete: true }];
    for (const [nom, generer] of documents) {
      for (const o of choix) writeFileSync(join(dossier!, `${nom} - ${libelleImpression(o)}.pdf`), await generer(o));
    }
  });
});

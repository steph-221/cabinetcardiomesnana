import { describe, expect, it } from "vitest";
import { themesDe } from "./themes";
import { doiDePage, doiDePdf, extraireDoi, metadonneesCrossref, pdfDePage, resumeEuropePmc } from "./resolution";

describe("thèmes", () => {
  it("range les recommandations ESC d'après leur titre", () => {
    expect(themesDe("2024 ESC Guidelines for the management of atrial fibrillation")[0]).toBe("fa");
    expect(themesDe("2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure")[0]).toBe("ic");
    expect(themesDe("2023 ESC Guidelines for the management of acute coronary syndromes")[0]).toBe("coronaires");
    expect(themesDe("2018 ESC/ESH Guidelines for the management of arterial hypertension")[0]).toBe("hta");
    expect(themesDe("2021 ESC/EACTS Guidelines for the management of valvular heart disease")[0]).toBe("valves");
    expect(themesDe("2019 ESC/EAS Guidelines for the management of dyslipidaemias")[0]).toBe("lipides");
    expect(themesDe("2019 ESC Guidelines for the diagnosis and management of acute pulmonary embolism")[0]).toBe("thrombose");
  });
  it("accepte plusieurs thèmes et le français", () => {
    expect(themesDe("Fibrillation atriale et insuffisance cardiaque : prise en charge")).toEqual(expect.arrayContaining(["fa", "ic"]));
  });
  it("ne reconnaît pas un sigle court à l'intérieur d'un mot", () => {
    expect(themesDe("Management of tavernous disorders")).not.toContain("thrombose");
    expect(themesDe("Traitement par AVK au long cours")).toContain("thrombose");
  });
  it("renvoie une liste vide quand rien ne correspond", () => {
    expect(themesDe("Rapport annuel de la société")).toEqual([]);
  });
});

describe("DOI", () => {
  it("lit un DOI dans un texte ou un lien", () => {
    expect(extraireDoi("https://doi.org/10.1093/eurheartj/ehae176.")).toBe("10.1093/eurheartj/ehae176");
    expect(extraireDoi("Eur Heart J (doi:10.1093/EURHEARTJ/EHAE176)")).toBe("10.1093/eurheartj/ehae176");
    expect(extraireDoi("aucun identifiant ici")).toBeNull();
  });
  it("trouve le DOI de la page ESC (lien vers l'éditeur) et d'une page à balises de citation", () => {
    const esc = '<a href="https://academic.oup.com/eurheartj/article-lookup/doi/10.1093/eurheartj/ehae176" target="_blank">Read</a>';
    expect(doiDePage(esc)).toBe("10.1093/eurheartj/ehae176");
    const revue = '<meta name="citation_doi" content="10.1161/CIR.0000000000001193"><meta name="citation_pdf_url" content="/doi/pdf/10.1161/CIR.0000000000001193">';
    expect(doiDePage(revue)).toBe("10.1161/cir.0000000000001193");
    expect(pdfDePage(revue, "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001193")).toBe(
      "https://www.ahajournals.org/doi/pdf/10.1161/CIR.0000000000001193",
    );
    expect(pdfDePage('<meta name="citation_pdf_url" content="http://x.org/a.pdf">', "https://x.org/")).toBe("");
    expect(doiDePage("<p>rien</p>")).toBeNull();
  });
  it("lit le DOI sur la première page d'un PDF, même coupé par un retour à la ligne", () => {
    expect(doiDePdf("European Heart Journal (2024) 45, 3314\nhttps://doi.org/10.1093/eurheartj/\nehae176")).toBe("10.1093/eurheartj/ehae176");
    expect(doiDePdf("Première page sans identifiant")).toBeNull();
  });
});

describe("services publics (client simulé)", () => {
  it("lit Crossref et Europe PMC, et renvoie null en cas d'échec", async () => {
    const crossref = async () => JSON.stringify({ message: { title: ["2024 ESC Guidelines for the <i>management</i> of AF"], "container-title": ["European Heart Journal"], issued: { "date-parts": [[2024, 8, 30]] } } });
    expect(await metadonneesCrossref("10.1093/x", crossref)).toEqual({ titre: "2024 ESC Guidelines for the management of AF", annee: 2024, revue: "European Heart Journal" });
    const pmc = async () => JSON.stringify({ resultList: { result: [{ abstractText: "<p>Résumé</p>", isOpenAccess: "Y", fullTextUrlList: { fullTextUrl: [{ url: "https://europepmc.org/a.pdf", documentStyle: "pdf", availability: "Open access" }] } }] } });
    expect(await resumeEuropePmc("10.1093/x", pmc)).toEqual({ resume: "Résumé", pdf: "https://europepmc.org/a.pdf", libre: true });
    const panne = async () => {
      throw new Error("403");
    };
    expect(await metadonneesCrossref("10.1093/x", panne)).toBeNull();
    expect(await resumeEuropePmc("10.1093/x", panne)).toBeNull();
    expect(await resumeEuropePmc("10.1093/x", async () => "pas du json")).toBeNull();
  });
});

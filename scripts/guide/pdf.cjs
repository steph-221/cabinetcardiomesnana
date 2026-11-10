// Génère docs/guide-medecin/guide-medecin.pdf à partir du guide HTML (Playwright, Chromium).
const { chromium } = require("playwright");
const path = require("path");
const dossier = path.join(__dirname, "..", "..", "docs", "guide-medecin");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + path.join(dossier, "guide-medecin.html"));
  await p.waitForLoadState("load");
  await p.waitForTimeout(1500);
  await p.pdf({
    path: path.join(dossier, "guide-medecin.pdf"), format: "A4", printBackground: true, displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: '<div style="font-size:8px;color:#94a3b8;width:100%;text-align:center">Guide du médecin — page <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
  });
  await b.close();
})();

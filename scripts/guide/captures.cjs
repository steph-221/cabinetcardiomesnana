const { chromium } = require("playwright");
const { createHmac } = require("crypto");
const SORTIE = require("path").join(__dirname, "..", "..", "docs", "guide-medecin", "captures");
const BASE = "http://localhost:3200";
const sig = (id) => createHmac("sha256", "d".repeat(40)).update(`rdv-gerer:${id}`).digest("base64url").slice(0, 32);
const erreurs = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5, locale: "fr-FR", timezoneId: "Africa/Casablanca" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erreurs.push("PAGEERROR " + e.message));
  const attendre = async (ms = 1200) => { await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(ms); };
  const cap = async (nom, chemin, { avant, hauteur, pleine = false } = {}) => {
    if (process.env.ONLY && !process.env.ONLY.split(",").includes(nom)) return;
    try {
      if (chemin) await p.goto(BASE + chemin);
      await attendre(1800);
      if (avant) await avant();
      const opts = { path: `${SORTIE}/${nom}.jpg`, type: "jpeg", quality: 82 };
      if (pleine) { opts.fullPage = true; if (hauteur) opts.clip = { x: 0, y: 0, width: 1280, height: hauteur }; }
      await p.screenshot(opts);
      const t = (await p.locator("body").innerText()).slice(0, 400);
      const bad = /This page couldn|Impossible de lire|Une erreur|introuvable/i.test(t);
      console.log(bad ? "⚠" : "✓", nom, bad ? "→ " + t.replace(/\n/g, " ").slice(0, 160) : "");
    } catch (e) { console.log("✗", nom, e.message.split("\n").slice(0, 12).join(" / ")); }
  };

  // Connexion (avant d'être connecté)
  await cap("01-connexion", "/fr/espace/connexion");
  await p.goto(BASE + "/fr/espace/connexion"); await p.waitForTimeout(800);
  await p.fill('input[name="identifiant"]', "taouab");
  await p.fill('input[name="motDePasse"]', "MotDePasseDemoTresLong1");
  await p.click('button[type="submit"]'); await attendre(2500);

  await cap("02-ma-journee", "/fr/espace/aujourdhui", { pleine: true, hauteur: 1700 });
  await cap("03-a-valider", "/fr/espace/a-valider");
  await cap("04-agenda", "/fr/espace", { pleine: true, hauteur: 1900 });
  await cap("05-rappels", "/fr/espace/rappels", { pleine: true, hauteur: 1300 });
  await cap("06-messages", "/fr/espace/messages", { pleine: true, hauteur: 1200 });
  await cap("07-liste-attente", "/fr/espace/liste-attente", { pleine: true, hauteur: 1500 });
  await cap("08-suivis", "/fr/espace/suivis");
  await cap("09-resultats", "/fr/espace/resultats", { pleine: true, hauteur: 1200 });
  await cap("10-patients", "/fr/espace/patients");
  await cap("11-fiche-patient", "/fr/espace/patients/1", { pleine: true, hauteur: 2200 });
  await cap("12-alertes", "/fr/espace/patients/4", { pleine: true, hauteur: 1500 });
  await cap("13-nouvelle-consultation", "/fr/espace/patients/1/consultation", { pleine: true, hauteur: 1500 });
  await cap("14-consultation-fin", "/fr/espace/patients/1/consultation/3", { pleine: true, hauteur: 1400 });
  // Micro dans un champ
  await cap("15-micro-champ", "/fr/espace/patients/1?onglet=fiche", { avant: async () => {
    const zone = p.locator('textarea[name="antecedents"]'); await zone.scrollIntoViewIfNeeded(); await zone.click(); await p.waitForTimeout(600);
  } });
  // Note vocale
  await cap("16-note-vocale", "/fr/espace/patients/1", { avant: async () => {
    await p.getByRole("button", { name: /Note vocale/ }).click(); await p.waitForTimeout(1200);
    const arret = p.getByRole("button", { name: "Arrêter", exact: true }); if (await arret.count()) await arret.first().click().catch(() => {});
    const fermer = p.getByRole("button", { name: "Fermer", exact: true }); if (await fermer.count()) await fermer.first().click().catch(() => {});
    await p.locator('textarea#note-vocale-texte').fill("Contrôle dans 6 mois avec échocardiographie. Arrêter le Cardix. Débuter bisoprolol 2,5 mg un comprimé le matin.");
    await p.waitForTimeout(500);
  } });
  // Ordonnance avec alertes
  await cap("17-ordonnance-alertes", "/fr/espace/patients/1/ordonnance", { avant: async () => {
    const champs = () => p.locator('input[name="medicament"]');
    const remplir = async (i, v) => {
      await champs().nth(i).fill(v); await p.waitForTimeout(1500);
      const choix = p.locator("ul.absolute li button").first(); if (await choix.count()) await choix.click(); await p.waitForTimeout(500);
    };
    await remplir(0, "Amoxicilline 1 g");
    await remplir(1, "Ramipril 5 mg");
    await p.getByRole("button", { name: /Ajouter une ligne/ }).click();
    await remplir(2, "Valsartan 80 mg");
    await p.locator('ul[aria-label="Vérifications de l\'ordonnance"]').scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  } });
  await cap("18-courrier", "/fr/espace/patients/1/courrier?consultation=3", { pleine: true, hauteur: 1500 });
  await cap("19-facture-proposee", "/fr/espace/comptabilite/factures/nouvelle?patient=1&consultation=3&actes=1,4", { pleine: true, hauteur: 1500 });
  await cap("20-comptabilite", "/fr/espace/comptabilite", { pleine: true, hauteur: 1400 });
  await cap("21-population", "/fr/espace/population", { pleine: true, hauteur: 1100 });
  await cap("22-calculateurs", "/fr/espace/calculateurs", { pleine: true, hauteur: 1500 });
  await cap("23-assistant", "/fr/espace/assistant", { pleine: true, hauteur: 1300 });
  await cap("24-bibliotheque", "/fr/espace/bibliotheque", { pleine: true, hauteur: 2000 });
  await cap("25-sites-revues", "/fr/espace/bibliotheque/sites", { pleine: true, hauteur: 1900 });
  await cap("26-medicaments", "/fr/espace/bibliotheque/medicaments", { pleine: true, hauteur: 1400 });
  await cap("27-lexique", "/fr/espace/lexique", { pleine: true, hauteur: 1000 });
  await cap("28-reprise-word", "/fr/espace/reprise", { pleine: true, hauteur: 1200 });
  await cap("29-modeles-ia", "/fr/espace/modeles-ia", { pleine: true, hauteur: 1900 });
  await cap("30-journal", "/fr/espace/journal", { pleine: true, hauteur: 1300 });
  await cap("31-drive", "/fr/espace/drive");
  // Côté patient
  await cap("32-reservation-en-ligne", "/fr/rendez-vous", { pleine: true, hauteur: 1500 });
  await cap("33-lien-patient", `/fr/rendez-vous/gerer?r=rdvdemo0001&t=${sig("rdvdemo0001")}`);
  console.log("ERREURS JS:", erreurs.length ? erreurs.join(" | ") : "aucune");
  await b.close();
})();

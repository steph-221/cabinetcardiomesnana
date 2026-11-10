// Agenda Google simulé : quelques rendez-vous fictifs pour aujourd'hui et demain (chargé avec NODE_OPTIONS=--require).
const vraiFetch = globalThis.fetch;
const jour = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const evt = (id, jourDecalage, h, m, nom, prenom, patientId, tel, email, motif, extra = {}) => {
  const debut = new Date(`${jour(jourDecalage)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+00:00`);
  const fin = new Date(debut.getTime() + (extra.duree ?? 30) * 60000);
  return {
    id, summary: `${extra.controle ? "Contrôle" : "RDV"} — ${prenom} ${nom}`, description: "Réservé en ligne sur le site",
    start: { dateTime: debut.toISOString() }, end: { dateTime: fin.toISOString() },
    extendedProperties: { private: { source: extra.source ?? "site", type: extra.controle ? "controle" : "consultation", nom, prenom, patientId: patientId ? String(patientId) : "", telephone: tel, email, motif, medecin: "taouab", ...(extra.confirme ? { confirme: new Date().toISOString() } : {}), ...(extra.rappel ? { rappelLe: new Date().toISOString() } : {}) } },
  };
};
const evenements = [
  evt("rdvdemo0001", 0, 9, 0, "BENNANI", "Salma", 1, "06 12 34 56 78", "salma.bennani@exemple.test", "Contrôle sous AVK", { confirme: true }),
  evt("rdvdemo0002", 0, 9, 30, "CHRAIBI", "Karim", 4, "06 70 55 44 33", "", "Essoufflement à l'effort", { source: "secretariat" }),
  evt("rdvdemo0003", 0, 10, 0, "TAZI", "Lina", 3, "07 70 11 22 33", "lina.tazi@exemple.test", "Palpitations", { rappel: true }),
  evt("rdvdemo0004", 0, 10, 30, "ALAMI", "Youssef", 0, "06 11 22 33 44", "", "Première consultation, bilan"),
  evt("rdvdemo0005", 0, 11, 15, "IDRISSI", "Omar", 2, "06 61 22 33 44", "", "Contrôle tension", { controle: true, duree: 10, source: "secretariat" }),
  evt("rdvdemo0006", 1, 9, 0, "FASSI", "Nadia", 5, "06 66 77 88 99", "nadia.fassi@exemple.test", "Reprise du suivi"),
  evt("rdvdemo0007", 1, 10, 0, "BENJELLOUN", "Hassan", 0, "06 22 33 44 55", "", "Douleur thoracique d'effort"),
  evt("rdvdemo0008", 2, 9, 30, "IDRISSI", "Omar", 2, "06 61 22 33 44", "", "Résultats de bilan"),
];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const rep = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  if (u.startsWith("https://oauth2.googleapis.com/token")) return rep({ access_token: "demo", expires_in: 3600 });
  if (u.startsWith("https://www.googleapis.com/calendar/v3")) {
    if (u.includes("/freeBusy")) return rep({ calendars: { demo: { busy: evenements.map((e) => ({ start: e.start.dateTime, end: e.end.dateTime })) } } });
    if (u.includes("/events/")) { const id = decodeURIComponent(u.split("/events/")[1].split("?")[0]); const e = evenements.find((x) => x.id === id); return e ? rep(e) : rep({}, 404); }
    if (u.includes("/events")) return rep({ items: evenements });
  }
  return vraiFetch(url, init);
};

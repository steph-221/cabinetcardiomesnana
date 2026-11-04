import { afterEach, describe, expect, it, vi } from "vitest";
import { messageChangement, prevenirPatient } from "./notification";
import { numeroInternational } from "./identite";

const changement = {
  prenom: "Salma",
  nom: "Alaoui",
  avant: new Date("2026-11-04T10:00:00Z"),
  apres: new Date("2026-11-06T14:30:00Z"),
};

describe("numéro international", () => {
  it("convertit les formats marocains courants", () => {
    expect(numeroInternational("06 12 34 56 78")).toBe("212612345678");
    expect(numeroInternational("+212 6 12 34 56 78")).toBe("212612345678");
    expect(numeroInternational("00212612345678")).toBe("212612345678");
    expect(numeroInternational("1234")).toBeNull();
  });
});

describe("message de changement de rendez-vous", () => {
  it("indique l'ancien et le nouveau rendez-vous", () => {
    const { sujet, texte } = messageChangement(changement);
    expect(sujet).toContain("mercredi 4 novembre 2026");
    expect(texte).toContain("Bonjour Salma ALAOUI");
    expect(texte).toContain("mercredi 4 novembre 2026 à 10:00");
    expect(texte).toContain("annulé et remplacé");
    expect(texte).toContain("vendredi 6 novembre 2026 à 14:30");
  });
});

describe("prévenir le patient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prépare des liens quand l'envoi automatique n'est pas configuré", async () => {
    const r = await prevenirPatient(changement, { email: "s@ex.ma", telephone: "0612345678" }, { email: true, whatsapp: true });
    expect(r.email.statut).toBe("lien");
    expect(r.email.lien).toMatch(/^mailto:s@ex\.ma\?subject=/);
    expect(r.whatsapp.statut).toBe("lien");
    expect(r.whatsapp.lien).toMatch(/^https:\/\/wa\.me\/212612345678\?text=/);
  });

  it("ne contacte que les canaux demandés et disponibles", async () => {
    const r = await prevenirPatient(changement, { email: "", telephone: "0612345678" }, { email: true, whatsapp: false });
    expect(r.email.statut).toBe("absent");
    expect(r.whatsapp.statut).toBe("absent");
  });

  it("envoie l'e-mail quand il est configuré, et garde le lien si l'envoi échoue", async () => {
    vi.stubEnv("RESEND_API_KEY", "cle");
    vi.stubEnv("EMAIL_EXPEDITEUR", "cabinet@ex.ma");
    const fetchSimule = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchSimule);
    const ok = await prevenirPatient(changement, { email: "s@ex.ma" }, { email: true, whatsapp: false });
    expect(ok.email).toMatchObject({ statut: "envoye", adresse: "s@ex.ma" });
    expect(ok.email.lien).toBeUndefined();
    const ko = await prevenirPatient(changement, { email: "s@ex.ma" }, { email: true, whatsapp: false });
    expect(ko.email.statut).toBe("echec");
    expect(ko.email.lien).toBeDefined();
  });
});

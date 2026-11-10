import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { estArabe, intentionDe, repondre, texteHoraires } from "./assistant-whatsapp";
import { messagesRecus, signatureWhatsAppValide } from "./whatsapp";

describe("intention du message", () => {
  const cas: [string, string][] = [
    ["Bonjour, quels sont vos horaires ?", "horaires"],
    ["vous êtes ouverts le samedi?", "horaires"],
    ["C'est quoi votre adresse svp", "adresse"],
    ["Comment venir au cabinet", "adresse"],
    ["je voudrais prendre rendez-vous", "rendez-vous"],
    ["Rdv pour la semaine prochaine ?", "rendez-vous"],
    ["bonjour", "salutation"],
    ["Salam", "salutation"],
    ["j'ai une douleur dans la poitrine depuis ce matin", "urgence"],
    ["mon père a fait un malaise", "urgence"],
    ["je suis essoufflé au moindre effort, c'est urgent", "urgence"],
    ["elle a perdu connaissance", "urgence"],
    ["السلام عليكم", "salutation"],
    ["واش عندكم موعد", "rendez-vous"],
    ["ما هو العنوان", "adresse"],
    ["عندي ألم في الصدر", "urgence"],
    ["ضيق في التنفس", "urgence"],
    ["Je voudrais savoir si mon ordonnance est prête", "autre"],
    ["Bonjour, j'ai mal à la tête, que dois-je prendre ?", "autre"],
  ];
  for (const [texte, attendu] of cas) {
    it(`« ${texte} » → ${attendu}`, () => expect(intentionDe(texte)).toBe(attendu));
  }
  it("l'urgence l'emporte sur tout, même avec une demande de rendez-vous", () => {
    expect(intentionDe("je voudrais un rendez-vous, j'ai une douleur thoracique")).toBe("urgence");
  });
  it("reconnaît l'arabe", () => {
    expect(estArabe("السلام عليكم")).toBe(true);
    expect(estArabe("bonjour")).toBe(false);
  });
});

describe("réponses de l'assistant", () => {
  it("renvoie vers le 141 et le 15 pour une urgence, et marque le message urgent", () => {
    const r = repondre("douleur thoracique");
    expect(r.urgent).toBe(true);
    expect(r.texte).toContain("141");
    expect(r.texte).toContain("15");
  });
  it("répond en arabe à un message en arabe", () => {
    expect(repondre("السلام عليكم").texte).toMatch(/[؀-ۿ]/);
    expect(repondre("عندي ألم في الصدر").texte).toContain("141");
  });
  it("donne les horaires du cabinet, regroupés par jours consécutifs", () => {
    expect(texteHoraires("fr", ["09:00 – 17:00", "09:00 – 17:00", "09:00 – 17:00", "09:00 – 17:00", "09:00 – 17:00", "09:30 – 14:00", null])).toBe(
      "lundi au vendredi : 09:00 – 17:00 ; samedi : 09:30 – 14:00 ; dimanche : fermé",
    );
    expect(repondre("horaires ?").texte).toContain("lundi au vendredi");
  });
  it("ne donne jamais d'avis médical et renvoie le reste au secrétariat", () => {
    const r = repondre("j'ai mal à la tête, que dois-je prendre ?");
    expect(r.intention).toBe("autre");
    expect(r.texte).toMatch(/secrétariat/);
    expect(r.texte).not.toMatch(/prenez|comprimé|doliprane|paracétamol|mg\b/i);
  });
});

describe("webhook WhatsApp", () => {
  const secret = "s".repeat(32);
  const corps = JSON.stringify({ a: 1 });
  const signe = (c: string, s = secret) => `sha256=${createHmac("sha256", s).update(c).digest("hex")}`;
  it("vérifie la signature du corps brut", () => {
    expect(signatureWhatsAppValide(corps, signe(corps), secret)).toBe(true);
    expect(signatureWhatsAppValide(corps + " ", signe(corps), secret)).toBe(false);
    expect(signatureWhatsAppValide(corps, signe(corps, "t".repeat(32)), secret)).toBe(false);
    expect(signatureWhatsAppValide(corps, null, secret)).toBe(false);
    expect(signatureWhatsAppValide(corps, signe(corps), undefined)).toBe(false);
  });
  it("lit les messages texte et ignore le reste", () => {
    const charge = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "212612345678", profile: { name: "Salma" } }],
                messages: [
                  { id: "wamid.1", from: "212612345678", timestamp: "1762761600", type: "text", text: { body: "Bonjour" } },
                  { id: "wamid.2", from: "212612345678", type: "image" },
                  { id: "wamid.3", from: "212612345678", type: "text", text: {} },
                ],
              },
            },
          ],
        },
      ],
    };
    const messages = messagesRecus(charge);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ id: "wamid.1", numero: "212612345678", nom: "Salma", texte: "Bonjour" });
    expect(messagesRecus(null)).toEqual([]);
    expect(messagesRecus({ entry: "x" })).toEqual([]);
  });
});

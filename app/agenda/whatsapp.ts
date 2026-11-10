// WhatsApp Business (Meta) : vérification du webhook, signature des appels reçus, lecture des messages et envoi de texte.
// Variables : WHATSAPP_VERIFY_TOKEN (vérification), WHATSAPP_APP_SECRET (signature), WHATSAPP_TOKEN et WHATSAPP_NUMERO_ID
// (envoi), WHATSAPP_ASSISTANT=1 pour activer les réponses automatiques (sinon les messages sont seulement enregistrés).

import { createHmac, timingSafeEqual } from "node:crypto";

// Meta signe le corps brut avec le secret de l'application : « X-Hub-Signature-256: sha256=… »
export function signatureWhatsAppValide(corps: string, entete: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !entete?.startsWith("sha256=")) return false;
  const attendu = Buffer.from(createHmac("sha256", secret).update(corps).digest("hex"));
  const recu = Buffer.from(entete.slice(7));
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}

export type MessageRecu = { id: string; numero: string; nom: string; texte: string; recuLe: Date };

// Messages texte d'une notification Meta (les images, vocaux, statuts de lecture… sont ignorés ici)
export function messagesRecus(charge: unknown): MessageRecu[] {
  const resultat: MessageRecu[] = [];
  const entrees = (charge as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entrees)) return resultat;
  for (const entree of entrees as { changes?: { value?: Record<string, unknown> }[] }[]) {
    for (const changement of entree.changes ?? []) {
      const valeur = changement.value ?? {};
      const contacts = (valeur.contacts as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? [];
      for (const m of (valeur.messages as { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } }[] | undefined) ?? []) {
        if (m.type !== "text" || !m.id || !m.from || !m.text?.body) continue;
        const secondes = Number(m.timestamp);
        resultat.push({
          id: m.id,
          numero: m.from.replace(/\D/g, ""),
          nom: contacts.find((c) => c.wa_id === m.from)?.profile?.name?.slice(0, 100) ?? "",
          texte: m.text.body.slice(0, 2000),
          recuLe: Number.isFinite(secondes) && secondes > 0 ? new Date(secondes * 1000) : new Date(),
        });
      }
    }
  }
  return resultat;
}

export const envoiWhatsAppConfigure = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_NUMERO_ID);
export const assistantActive = () => process.env.WHATSAPP_ASSISTANT === "1" && envoiWhatsAppConfigure();

// Texte libre : permis par WhatsApp dans les 24 h qui suivent un message du patient
export async function envoyerTexteWhatsApp(numero: string, texte: string) {
  const reponse = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_NUMERO_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: numero, type: "text", text: { body: texte, preview_url: false } }),
    cache: "no-store",
  });
  if (!reponse.ok) throw new Error(`WhatsApp refusé (${reponse.status})`);
}

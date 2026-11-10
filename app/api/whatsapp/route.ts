// Webhook WhatsApp Business (Meta) : reçoit les messages des patients, les enregistre dans la boîte Messages et, si
// l'assistant est activé (WHATSAPP_ASSISTANT=1), répond aux questions pratiques. L'appel est authentifié par la
// signature de Meta (WHATSAPP_APP_SECRET) ; sans elle, rien n'est lu. Voir RESERVATION.md.

import { after } from "next/server";
import { intentionDe, repondre } from "../../agenda/assistant-whatsapp";
import { assistantActive, envoyerTexteWhatsApp, messagesRecus, signatureWhatsAppValide } from "../../agenda/whatsapp";
import { baseConfiguree } from "../../dossier/base";
import { journaliser } from "../../dossier/journal";
import { accuseRecentEnvoye, enregistrerMessage, noterReponseAuto } from "../../dossier/messages-whatsapp";

// Vérification demandée par Meta quand on déclare l'adresse du webhook
export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const attendu = process.env.WHATSAPP_VERIFY_TOKEN;
  if (attendu && attendu.length >= 16 && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === attendu) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Refusé", { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("Webhook non activé (WHATSAPP_APP_SECRET).", { status: 503 });
  const corps = await request.text();
  if (!signatureWhatsAppValide(corps, request.headers.get("x-hub-signature-256"), secret)) return new Response("Signature invalide.", { status: 401 });
  if (!baseConfiguree()) return new Response("Base de données non configurée.", { status: 503 });

  let charge: unknown;
  try {
    charge = JSON.parse(corps);
  } catch {
    return new Response("Corps illisible.", { status: 400 });
  }
  const messages = messagesRecus(charge);
  // Meta attend une réponse rapide : l'enregistrement et les réponses se font après avoir répondu 200
  after(async () => {
    for (const m of messages) {
      try {
        const reponse = repondre(m.texte);
        const id = await enregistrerMessage({ ...m, intention: intentionDe(m.texte), urgent: reponse.urgent });
        if (id === null) continue; // déjà reçu
        if (reponse.urgent) await journaliser("whatsapp", "message WhatsApp urgent reçu", null, `n° ${id}`);
        if (!assistantActive()) continue;
        // Un seul accusé de réception « message à traiter » par conversation et par demi-journée
        if (reponse.intention === "autre" && (await accuseRecentEnvoye(m.numero))) continue;
        await envoyerTexteWhatsApp(m.numero, reponse.texte);
        await noterReponseAuto(id, reponse.texte);
      } catch (erreur) {
        console.error(erreur);
      }
    }
  });
  return new Response("ok", { status: 200 });
}

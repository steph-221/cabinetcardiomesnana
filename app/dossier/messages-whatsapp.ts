// Messages WhatsApp reçus : enregistrés à l'arrivée, traités par le secrétariat. Les messages peuvent contenir des
// informations de santé : ils restent dans la base du cabinet et sont journalisés comme le reste du dossier.

import { base } from "./base";

export type MessageWhatsApp = {
  id: number;
  numero: string;
  nom: string;
  texte: string;
  intention: string;
  urgent: boolean;
  reponseAuto: string;
  recuLe: Date;
  traiteLe: Date | null;
  traitePar: string | null;
  patientId: number | null;
};

// Faux si ce message (même identifiant WhatsApp) était déjà enregistré : Meta renvoie parfois une notification deux fois
export async function enregistrerMessage(m: { id: string; numero: string; nom: string; texte: string; recuLe: Date; intention: string; urgent: boolean }) {
  const sql = await base();
  const lignes = await sql`
    INSERT INTO messages_whatsapp (wa_id, numero, nom, texte, intention, urgent, recu_le)
    VALUES (${m.id}, ${m.numero}, ${m.nom}, ${m.texte}, ${m.intention}, ${m.urgent}, ${m.recuLe})
    ON CONFLICT (wa_id) DO NOTHING RETURNING id`;
  return lignes.length ? (lignes[0].id as number) : null;
}

export async function noterReponseAuto(id: number, texte: string) {
  const sql = await base();
  await sql`UPDATE messages_whatsapp SET reponse_auto = ${texte} WHERE id = ${id}`;
}

// Une réponse automatique de « message à traiter » a-t-elle déjà été envoyée à ce numéro récemment ? (évite de répéter
// le même accusé de réception à chaque message d'une conversation)
export async function accuseRecentEnvoye(numero: string, heures = 12) {
  const sql = await base();
  const [l] = await sql`
    SELECT count(*)::int AS n FROM messages_whatsapp
    WHERE numero = ${numero} AND intention = 'autre' AND reponse_auto <> '' AND recu_le > now() - make_interval(hours => ${heures})`;
  return (l.n as number) > 0;
}

// À traiter d'abord (urgents en tête), puis les messages traités depuis moins de 3 jours
export async function listerMessages(): Promise<MessageWhatsApp[]> {
  const sql = await base();
  const lignes = await sql`
    SELECT m.*, (SELECT p.id FROM patients p WHERE right(p.telephone_chiffres, 9) = right(m.numero, 9) AND length(m.numero) >= 9
                 ORDER BY p.modifie_le DESC LIMIT 1) AS patient_id
    FROM messages_whatsapp m
    WHERE m.traite_le IS NULL OR m.traite_le > now() - interval '3 days'
    ORDER BY (m.traite_le IS NULL) DESC, m.urgent DESC, m.recu_le DESC LIMIT 200`;
  return lignes.map((l) => ({
    id: l.id as number,
    numero: l.numero as string,
    nom: l.nom as string,
    texte: l.texte as string,
    intention: l.intention as string,
    urgent: l.urgent as boolean,
    reponseAuto: l.reponse_auto as string,
    recuLe: l.recu_le as Date,
    traiteLe: (l.traite_le as Date | null) ?? null,
    traitePar: (l.traite_par as string | null) ?? null,
    patientId: (l.patient_id as number | null) ?? null,
  }));
}

export async function compterMessages(): Promise<{ aTraiter: number; urgents: number }> {
  const sql = await base();
  const [l] = await sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE urgent)::int AS u FROM messages_whatsapp WHERE traite_le IS NULL`;
  return { aTraiter: l.n as number, urgents: l.u as number };
}

export async function marquerTraite(id: number, par: string, traite: boolean) {
  const sql = await base();
  await sql`UPDATE messages_whatsapp SET traite_le = ${traite ? new Date() : null}, traite_par = ${traite ? par : null} WHERE id = ${id}`;
}

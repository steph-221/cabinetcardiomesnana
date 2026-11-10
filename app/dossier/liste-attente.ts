// Liste d'attente : patients qui veulent un créneau plus tôt, et créneaux libérés par des annulations. Le secrétariat
// prévient les patients en attente d'un clic (lien WhatsApp ou e-mail préparé). Rien ne part sans lui.

import { base } from "./base";

export type Attente = {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  souhait: string;
  prevenuLe: Date | null;
  creeLe: Date;
};

export type CreneauLibere = { id: number; debut: Date; fin: Date; medecin: string; libereLe: Date; origine: string };

export async function listerAttente(): Promise<Attente[]> {
  const sql = await base();
  const lignes = await sql`SELECT * FROM liste_attente WHERE statut = 'attend' ORDER BY cree_le, id LIMIT 300`;
  return lignes.map((l) => ({
    id: l.id as number,
    nom: l.nom as string,
    prenom: l.prenom as string,
    telephone: l.telephone as string,
    email: l.email as string,
    souhait: l.souhait as string,
    prevenuLe: (l.prevenu_le as Date | null) ?? null,
    creeLe: l.cree_le as Date,
  }));
}

export async function ajouterAttente(a: { nom: string; prenom: string; telephone: string; email: string; souhait: string }, par: string) {
  const sql = await base();
  await sql`
    INSERT INTO liste_attente (nom, prenom, telephone, email, souhait, cree_par)
    VALUES (${a.nom}, ${a.prenom}, ${a.telephone}, ${a.email}, ${a.souhait}, ${par})`;
}

export async function classerAttente(id: number, statut: "place" | "retire") {
  const sql = await base();
  await sql`UPDATE liste_attente SET statut = ${statut} WHERE id = ${id}`;
}

export async function marquerPrevenu(id: number) {
  const sql = await base();
  await sql`UPDATE liste_attente SET prevenu_le = now() WHERE id = ${id}`;
}

// Un rendez-vous annulé libère son créneau : retenu ici pour le proposer, tant qu'il est dans le futur
export async function noterCreneauLibere(c: { debut: Date; fin: Date; medecin: string; origine: string }) {
  if (c.debut.getTime() < Date.now()) return;
  const sql = await base();
  await sql`INSERT INTO creneaux_liberes (debut, fin, medecin, origine) VALUES (${c.debut}, ${c.fin}, ${c.medecin}, ${c.origine})`;
}

export async function listerCreneauxLibres(): Promise<CreneauLibere[]> {
  const sql = await base();
  const lignes = await sql`SELECT * FROM creneaux_liberes WHERE traite_le IS NULL AND debut > now() ORDER BY debut LIMIT 50`;
  return lignes.map((l) => ({
    id: l.id as number,
    debut: l.debut as Date,
    fin: l.fin as Date,
    medecin: l.medecin as string,
    libereLe: l.libere_le as Date,
    origine: l.origine as string,
  }));
}

export async function traiterCreneau(id: number) {
  const sql = await base();
  await sql`UPDATE creneaux_liberes SET traite_le = now() WHERE id = ${id}`;
}

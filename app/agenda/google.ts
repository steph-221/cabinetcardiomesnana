// Accès à l'agenda Google du cabinet via un compte de service.
// Variables d'environnement : voir RESERVATION.md.

import { createSign } from "node:crypto";
import { cabinet } from "../cabinet";
import { ajouterJours } from "./creneaux";

const API = "https://www.googleapis.com/calendar/v3";

export type Rendezvous = {
  id: string;
  titre: string;
  debut: string; // ISO
  fin: string; // ISO
  telephone?: string;
  motif?: string;
  dateNaissance?: string; // "AAAA-MM-JJ"
  email?: string;
  controle: boolean; // rendez-vous de contrôle court, glissé entre deux consultations
  enLigne: boolean;
  annulable: boolean; // rendez-vous patient créé par le site ou l'espace cabinet
  fermeture: boolean; // créneaux fermés par l'administrateur
};

const config = () => ({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  cle: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  agenda: process.env.GOOGLE_CALENDAR_ID,
});

export const agendaConfigure = () => {
  const { email, cle, agenda } = config();
  return Boolean(email && cle && agenda);
};

const base64url = (texte: string | Buffer) => Buffer.from(texte).toString("base64url");

let jeton: { valeur: string; expire: number } | null = null;

// Échange un JWT signé avec la clé du compte de service contre un jeton d'accès
async function jetonAcces() {
  if (jeton && jeton.expire > Date.now() + 60_000) return jeton.valeur;
  const { email, cle } = config();
  if (!email || !cle) throw new Error("Agenda Google non configuré");

  const maintenant = Math.floor(Date.now() / 1000);
  const entete = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const contenu = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: maintenant,
      exp: maintenant + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${entete}.${contenu}`).sign(cle, "base64url");

  const reponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${entete}.${contenu}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!reponse.ok) throw new Error(`Authentification Google refusée (${reponse.status})`);
  const { access_token, expires_in } = (await reponse.json()) as { access_token: string; expires_in: number };
  jeton = { valeur: access_token, expire: Date.now() + expires_in * 1000 };
  return access_token;
}

async function appel<T>(chemin: string, init: RequestInit = {}): Promise<T> {
  const reponse = await fetch(`${API}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${await jetonAcces()}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!reponse.ok) throw new Error(`Agenda Google : erreur ${reponse.status} sur ${chemin}`);
  return (reponse.status === 204 ? undefined : await reponse.json()) as T;
}

const idAgenda = () => encodeURIComponent(config().agenda!);

// Périodes déjà occupées dans l'agenda (rendez-vous, absences, congés…)
export async function periodesOccupees(debut: Date, fin: Date) {
  const reponse = await appel<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>(
    "/freeBusy",
    {
      method: "POST",
      body: JSON.stringify({ timeMin: debut.toISOString(), timeMax: fin.toISOString(), items: [{ id: config().agenda }] }),
    },
  );
  return (reponse.calendars[config().agenda!]?.busy ?? []).map((p) => ({
    debut: new Date(p.start).getTime(),
    fin: new Date(p.end).getTime(),
  }));
}

type EvenementGoogle = {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

export async function listerRendezvous(debut: Date, fin: Date): Promise<Rendezvous[]> {
  const params = new URLSearchParams({
    timeMin: debut.toISOString(),
    timeMax: fin.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });
  const { items } = await appel<{ items: EvenementGoogle[] }>(`/calendars/${idAgenda()}/events?${params}`);
  return items.map((e) => {
    const prive = e.extendedProperties?.private ?? {};
    return {
      id: e.id,
      titre: e.summary ?? "(sans titre)",
      // Les événements « journée entière » n'ont qu'une date
      debut: e.start.dateTime ?? e.start.date!,
      fin: e.end.dateTime ?? e.end.date!,
      telephone: prive.telephone,
      motif: prive.motif,
      dateNaissance: prive.dateNaissance,
      email: prive.email,
      controle: prive.type === "controle",
      enLigne: prive.source === "site",
      annulable: prive.source === "site" || prive.source === "secretariat",
      fermeture: prive.source === "fermeture",
    };
  });
}

export async function creerRendezvous(rdv: {
  debut: Date;
  fin: Date;
  nom: string;
  telephone: string;
  motif: string;
  dateNaissance?: string;
  email?: string;
  controle?: boolean;
  source: "site" | "secretariat";
  par?: string;
}) {
  const description = [
    `Téléphone : ${rdv.telephone}`,
    rdv.dateNaissance && `Date de naissance : ${rdv.dateNaissance.split("-").reverse().join("/")}`,
    rdv.email && `E-mail : ${rdv.email}`,
    rdv.motif && `Motif : ${rdv.motif}`,
    rdv.source === "site" ? "Réservé en ligne sur le site" : `Ajouté par ${rdv.par ?? "le secrétariat"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return appel<EvenementGoogle>(`/calendars/${idAgenda()}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: `${rdv.controle ? "Contrôle" : "RDV"} — ${rdv.nom}`,
      description,
      // Un contrôle se glisse entre deux consultations : il ne retire pas de créneau aux patients
      transparency: rdv.controle ? "transparent" : "opaque",
      start: { dateTime: rdv.debut.toISOString(), timeZone: cabinet.fuseau },
      end: { dateTime: rdv.fin.toISOString(), timeZone: cabinet.fuseau },
      extendedProperties: {
        private: {
          source: rdv.source,
          type: rdv.controle ? "controle" : "consultation",
          telephone: rdv.telephone,
          motif: rdv.motif,
          dateNaissance: rdv.dateNaissance ?? "",
          email: rdv.email ?? "",
        },
      },
    }),
  });
}

// Ferme des créneaux : un événement « occupé » dans l'agenda les retire du site.
// Soit des journées entières (jourFin inclus), soit une plage horaire.
export async function creerFermeture(
  periode: { jourDebut: string; jourFin: string } | { debut: Date; fin: Date },
  motif: string,
  par: string,
) {
  const dates =
    "jourDebut" in periode
      ? // Pour Google, la date de fin d'un événement « journée entière » est exclue
        { start: { date: periode.jourDebut }, end: { date: ajouterJours(periode.jourFin, 1) } }
      : {
          start: { dateTime: periode.debut.toISOString(), timeZone: cabinet.fuseau },
          end: { dateTime: periode.fin.toISOString(), timeZone: cabinet.fuseau },
        };
  return appel<EvenementGoogle>(`/calendars/${idAgenda()}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: `Fermé${motif ? ` — ${motif}` : ""}`,
      description: `Créneaux fermés à la réservation en ligne par ${par}`,
      transparency: "opaque",
      ...dates,
      extendedProperties: { private: { source: "fermeture", motif } },
    }),
  });
}

export async function supprimerRendezvous(id: string) {
  await appel(`/calendars/${idAgenda()}/events/${encodeURIComponent(id)}`, { method: "DELETE" });
}

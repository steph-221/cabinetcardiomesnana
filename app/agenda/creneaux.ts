// Calcul des créneaux de rendez-vous à partir des horaires du cabinet.
// Les dates sont manipulées en heure du cabinet (Africa/Casablanca) quel que soit le serveur.

import { cabinet } from "../cabinet";

export type Jour = string; // "AAAA-MM-JJ"

const formatParties = new Intl.DateTimeFormat("en-US", {
  timeZone: cabinet.fuseau,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parties(date: Date) {
  const p = Object.fromEntries(formatParties.formatToParts(date).map((x) => [x.type, x.value]));
  return { an: +p.year, mois: +p.month, jour: +p.day, heure: +p.hour, minute: +p.minute, seconde: +p.second };
}

// Écart en millisecondes entre l'heure du cabinet et l'heure UTC à cet instant
function decalage(date: Date) {
  const p = parties(date);
  return Date.UTC(p.an, p.mois - 1, p.jour, p.heure, p.minute, p.seconde) - Math.floor(date.getTime() / 1000) * 1000;
}

// "2026-10-27" + "09:30" (heure du cabinet) → instant réel
export function dateLocale(jour: Jour, heure: string) {
  const [a, m, j] = jour.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const naif = Date.UTC(a, m - 1, j, h, mi);
  // Deux passes pour tomber juste autour d'un changement d'heure
  const premier = naif - decalage(new Date(naif));
  return new Date(naif - decalage(new Date(premier)));
}

export function jourLocal(date: Date): Jour {
  const p = parties(date);
  return `${p.an}-${String(p.mois).padStart(2, "0")}-${String(p.jour).padStart(2, "0")}`;
}

export function heureLocale(date: Date) {
  const p = parties(date);
  return `${String(p.heure).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export const estJour = (valeur: string): valeur is Jour => /^\d{4}-\d{2}-\d{2}$/.test(valeur);

// Indice dans cabinet.horaires : 0 = lundi … 6 = dimanche
export function indiceSemaine(jour: Jour) {
  const [a, m, j] = jour.split("-").map(Number);
  return (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7;
}

export function ajouterJours(jour: Jour, n: number): Jour {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

// "09:00 – 17:00" → ["09:00", "17:00"]
function ouverture(jour: Jour) {
  const horaire = cabinet.horaires[indiceSemaine(jour)];
  if (!horaire) return null;
  const [ouvre, ferme] = horaire.split("–").map((h) => h.trim());
  return { ouvre, ferme };
}

// Jours ouverts pendant lesquels un patient peut réserver
export function joursReservables(maintenant = new Date()) {
  const aujourdhui = jourLocal(maintenant);
  const jours: Jour[] = [];
  for (let i = 0; i <= cabinet.joursReservables; i++) {
    const jour = ajouterJours(aujourdhui, i);
    if (ouverture(jour)) jours.push(jour);
  }
  return jours;
}

// Tous les créneaux d'une journée, sans tenir compte de l'agenda
export function creneauxDuJour(jour: Jour, maintenant = new Date()) {
  const horaires = ouverture(jour);
  if (!horaires) return [];
  const duree = cabinet.dureeRdv * 60_000;
  const limite = maintenant.getTime() + cabinet.delaiMinimum * 3_600_000;
  const fin = dateLocale(jour, horaires.ferme).getTime();
  const creneaux: { heure: string; debut: Date; fin: Date }[] = [];
  for (let t = dateLocale(jour, horaires.ouvre).getTime(); t + duree <= fin; t += duree) {
    if (t < limite) continue;
    creneaux.push({ heure: heureLocale(new Date(t)), debut: new Date(t), fin: new Date(t + duree) });
  }
  return creneaux;
}

export const chevauche = (a: { debut: number; fin: number }, b: { debut: number; fin: number }) =>
  a.debut < b.fin && b.debut < a.fin;

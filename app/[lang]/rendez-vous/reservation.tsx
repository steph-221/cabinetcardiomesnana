"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CalendarCheck, CircleCheck } from "lucide-react";
import type { Langue } from "../../cabinet";
import type { Dictionnaire } from "../dictionaries";
import { creneauxLibres, reserver, type EtatReservation } from "./actions";

// "2026-10-27" → "mardi 27 octobre" dans la langue du visiteur
function formaterJour(jour: string, langue: Langue, options: Intl.DateTimeFormatOptions) {
  const [a, m, j] = jour.split("-").map(Number);
  return new Intl.DateTimeFormat(langue === "ar" ? "ar-MA" : langue, { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, j)),
  );
}

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

export function Reservation({
  langue,
  t,
  jours,
}: {
  langue: Langue;
  t: Dictionnaire["reservation"];
  jours: string[];
}) {
  const [jour, setJour] = useState<string | null>(null);
  const [heure, setHeure] = useState<string | null>(null);
  const [creneaux, setCreneaux] = useState<string[] | null>([]);
  const [chargement, demarrer] = useTransition();
  const [etat, envoyer, envoi] = useActionState<EtatReservation, FormData>(reserver, { statut: "attente" });

  const saisi = etat.statut === "erreur" ? etat.valeurs : undefined;

  const choisirJour = (j: string) => {
    setJour(j);
    setHeure(null);
    demarrer(async () => setCreneaux(await creneauxLibres(j)));
  };

  // Créneau pris entre-temps : recharge les horaires libres du jour
  const creneauPris = etat.statut === "erreur" && etat.code === "creneauPris";
  useEffect(() => {
    if (creneauPris && jour) demarrer(async () => setCreneaux(await creneauxLibres(jour)));
  }, [etat, creneauPris, jour]);

  if (etat.statut === "confirme") {
    return (
      <div className="mt-10 rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <CircleCheck className="h-6 w-6" aria-hidden />
          {t.confirme}
        </h2>
        <p className="mt-2">
          {formaterJour(etat.jour, langue, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
          <span dir="ltr">{etat.heure}</span>
        </p>
        <p className="mt-4 text-sm">{t.confirmeTexte}</p>
      </div>
    );
  }

  return (
    <form action={envoyer} className="mt-10 space-y-8">
      <fieldset>
        <legend className="text-lg font-semibold text-slate-900">1. {t.choisirJour}</legend>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {jours.map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => choisirJour(j)}
              aria-pressed={j === jour}
              className={`rounded-lg border px-2 py-2 text-sm ${
                j === jour
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-slate-200 text-slate-700 hover:border-red-300 hover:bg-red-50"
              }`}
            >
              <span className="block capitalize">{formaterJour(j, langue, { weekday: "short" })}</span>
              <span className="block font-semibold">{formaterJour(j, langue, { day: "numeric", month: "short" })}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {jour && (
        <fieldset>
          <legend className="text-lg font-semibold text-slate-900">2. {t.choisirHeure}</legend>
          {chargement ? (
            <p className="mt-3 text-sm text-slate-500">{t.chargement}</p>
          ) : creneaux === null ? (
            <p className="mt-3 text-sm text-red-700">{t.erreurs.technique}</p>
          ) : creneaux.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t.complet}</p>
          ) : (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6" dir="ltr">
              {creneaux.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHeure(h)}
                  aria-pressed={h === heure}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                    h === heure
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-slate-200 text-slate-700 hover:border-red-300 hover:bg-red-50"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {jour && heure && (
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-slate-900">3. {t.vosCoordonnees}</legend>
          <input type="hidden" name="jour" value={jour} />
          <input type="hidden" name="heure" value={heure} />
          {/* Piège à robots, invisible pour les visiteurs */}
          <input type="text" name="site" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <label className="block text-sm font-medium text-slate-700">
            {t.nom}
            <input
              name="nom"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              defaultValue={saisi?.nom}
              className={champ}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t.telephone}
            <input
              name="telephone"
              type="tel"
              required
              pattern="\+?[\d\s.\-]{8,20}"
              autoComplete="tel"
              dir="ltr"
              defaultValue={saisi?.telephone}
              className={champ}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              {t.dateNaissance} <span className="font-normal text-slate-400">({t.facultatif})</span>
              <input
                name="dateNaissance"
                type="date"
                min="1900-01-01"
                autoComplete="bday"
                defaultValue={saisi?.dateNaissance}
                className={champ}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t.email} <span className="font-normal text-slate-400">({t.facultatif})</span>
              <input
                name="email"
                type="email"
                maxLength={100}
                autoComplete="email"
                dir="ltr"
                defaultValue={saisi?.email}
                className={champ}
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            {t.motif} <span className="font-normal text-slate-400">({t.facultatif})</span>
            <textarea name="motif" rows={3} maxLength={300} defaultValue={saisi?.motif} className={champ} />
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="consentement" required className="mt-1" />
            <span>{t.consentement}</span>
          </label>

          {etat.statut === "erreur" && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {t.erreurs[etat.code]}
            </p>
          )}

          <button
            type="submit"
            disabled={envoi}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            <CalendarCheck className="h-5 w-5" aria-hidden />
            {envoi ? t.envoi : t.confirmer}
          </button>
        </fieldset>
      )}
    </form>
  );
}

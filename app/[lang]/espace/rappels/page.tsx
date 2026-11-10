import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Bell, Check, Clock } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { ajouterJours, dateLocale, heureLocale, jourLocal } from "../../../agenda/creneaux";
import { agendaConfigure, listerRendezvous, type Rendezvous } from "../../../agenda/google";
import { signatureRdv } from "../../../agenda/lien-patient";
import { emailConfigure } from "../../../agenda/notification";
import { exigerUtilisateur } from "../../../agenda/session";
import { BoutonRappel } from "./bouton";

export const metadata: Metadata = {
  title: "Rappels de rendez-vous",
  robots: { index: false, follow: false },
};

export default async function Rappels({ params }: PageProps<"/[lang]/espace/rappels">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Bell className="h-6 w-6 text-red-600" aria-hidden />
        Rappels de rendez-vous
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Chaque patient reçoit un lien personnel pour confirmer ou annuler. Un annulé libère son créneau tout de suite.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} />
      </Suspense>
    </div>
  );
}

const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Casablanca" });

async function Liste({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue);
  const aujourdhui = jourLocal(new Date());
  if (!agendaConfigure()) return <p className="mt-6 text-slate-500">L&apos;agenda Google n&apos;est pas configuré (voir RESERVATION.md).</p>;
  let rdvs: Rendezvous[];
  try {
    rdvs = (await listerRendezvous(dateLocale(aujourdhui, "00:00"), dateLocale(ajouterJours(aujourdhui, 3), "00:00"))).filter(
      (r) => !r.fermeture && r.debut.length > 10 && (r.annulable || r.email || r.telephone),
    );
  } catch (erreur) {
    console.error(erreur);
    return <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">Impossible de lire l&apos;agenda Google.</p>;
  }
  const parJour = new Map<string, Rendezvous[]>();
  for (const r of rdvs) parJour.set(jourLocal(new Date(r.debut)), [...(parJour.get(jourLocal(new Date(r.debut))) ?? []), r]);
  const titre = (j: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${j}T12:00:00Z`));
  const sansLien = !signatureRdv("test");

  return (
    <>
      {sansLien && (
        <p role="note" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Sans la variable SESSION_SECRET (32 caractères au moins), les rappels n&apos;ont pas de lien de confirmation : le patient
          est invité à téléphoner.
        </p>
      )}
      <p className="mt-4 text-xs text-slate-500">
        {emailConfigure()
          ? "Envoi automatique par e-mail activé : les rendez-vous du lendemain sont rappelés chaque après-midi."
          : "Envoi automatique non activé : le bouton prépare l'e-mail et le message WhatsApp, à envoyer d'un clic (voir RESERVATION.md)."}
      </p>
      {parJour.size === 0 ? (
        <p className="mt-6 text-slate-500">Aucun rendez-vous dans les prochains jours.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {[...parJour].map(([j, liste]) => (
            <section key={j}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 first-letter:capitalize">{titre(j)}</h2>
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {liste.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">
                        <span className="me-2 font-mono text-slate-500">{heureLocale(new Date(r.debut))}</span>
                        {r.titre}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{[r.email, r.telephone].filter(Boolean).join(" · ") || "Aucun contact"}</p>
                      <p className="mt-1 text-xs">
                        {r.confirme ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-900">
                            <Check className="h-3 w-3" aria-hidden />
                            Confirmé le {date(r.confirme)}
                          </span>
                        ) : r.rappelLe ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-sky-900">
                            <Clock className="h-3 w-3" aria-hidden />
                            Rappel du {date(r.rappelLe)}, sans réponse
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Pas encore rappelé</span>
                        )}
                      </p>
                    </div>
                    {(r.email || r.telephone) && !r.confirme && <BoutonRappel langue={langue} id={r.id} deja={Boolean(r.rappelLe)} />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

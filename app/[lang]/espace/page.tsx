import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CalendarDays, Globe, LogOut, Phone } from "lucide-react";
import { estLangue } from "../../cabinet";
import { ajouterJours, dateLocale, heureLocale, jourLocal } from "../../agenda/creneaux";
import { agendaConfigure, listerRendezvous, type Rendezvous } from "../../agenda/google";
import { utilisateurConnecte } from "../../agenda/session";
import { deconnexion } from "./actions";
import { BoutonAnnuler, FormulaireAjout } from "./boutons";

export const metadata: Metadata = {
  title: "Espace cabinet",
  robots: { index: false, follow: false },
};

const JOURS_AFFICHES = 14;

export default async function Espace({ params }: PageProps<"/[lang]/espace">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement de l&apos;agenda…</p>}>
        <Tableau langue={lang} />
      </Suspense>
    </div>
  );
}

async function Tableau({ langue }: { langue: string }) {
  // Agenda en direct : jamais préchargé ni mis en cache
  await connection();
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect(`/${langue}/espace/connexion`);

  const aujourdhui = jourLocal(new Date());
  let rendezvous: Rendezvous[] | null = null;
  if (agendaConfigure()) {
    try {
      rendezvous = await listerRendezvous(
        dateLocale(aujourdhui, "00:00"),
        dateLocale(ajouterJours(aujourdhui, JOURS_AFFICHES), "00:00"),
      );
    } catch (erreur) {
      console.error(erreur);
    }
  }

  // Regroupe par jour (les événements « journée entière » n'ont qu'une date)
  const parJour = new Map<string, Rendezvous[]>();
  for (const r of rendezvous ?? []) {
    const jour = r.debut.length === 10 ? r.debut : jourLocal(new Date(r.debut));
    parJour.set(jour, [...(parJour.get(jour) ?? []), r]);
  }
  const titreJour = (jour: string) =>
    new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${jour}T12:00:00Z`),
    );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda du cabinet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connecté·e : <strong>{utilisateur}</strong>
          </p>
        </div>
        <form action={deconnexion.bind(null, langue)}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Se déconnecter
          </button>
        </form>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Ajouter un rendez-vous</h2>
        <FormulaireAjout langue={langue} aujourdhui={aujourdhui} />
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <CalendarDays className="h-5 w-5 text-red-600" aria-hidden />
          Les {JOURS_AFFICHES} prochains jours
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Pour bloquer un créneau (congé, absence, réunion), ajoutez simplement un événement dans Google Agenda : il
          ne sera plus proposé aux patients.
        </p>

        {rendezvous === null ? (
          <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            Impossible de lire l&apos;agenda Google. Vérifiez la configuration (voir RESERVATION.md).
          </p>
        ) : parJour.size === 0 ? (
          <p className="mt-6 text-slate-500">Aucun rendez-vous pour le moment.</p>
        ) : (
          <div className="mt-6 space-y-6">
            {[...parJour].map(([jour, liste]) => (
              <div key={jour}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 first-letter:capitalize">
                  {titreJour(jour)}
                </h3>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {liste.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="flex gap-4">
                        <span className="w-24 shrink-0 font-mono text-sm text-slate-700">
                          {r.debut.length === 10
                            ? "Journée"
                            : `${heureLocale(new Date(r.debut))}–${heureLocale(new Date(r.fin))}`}
                        </span>
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">
                            {r.titre}
                            {r.enLigne && (
                              <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-normal text-blue-700">
                                <Globe className="h-3 w-3" aria-hidden />
                                en ligne
                              </span>
                            )}
                          </p>
                          {r.telephone && (
                            <a
                              href={`tel:${r.telephone.replace(/[^\d+]/g, "")}`}
                              className="mt-1 inline-flex items-center gap-1 text-slate-600 hover:text-red-700"
                            >
                              <Phone className="h-3 w-3" aria-hidden />
                              {r.telephone}
                            </a>
                          )}
                          {r.motif && <p className="mt-1 text-slate-500">{r.motif}</p>}
                        </div>
                      </div>
                      {/* Seuls les rendez-vous patients sont annulables ici ; le reste se gère dans Google Agenda */}
                      {r.annulable && <BoutonAnnuler langue={langue} id={r.id} nom={r.titre} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

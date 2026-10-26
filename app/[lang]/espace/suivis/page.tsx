import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { CalendarClock } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { ajouterJours, jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { suivisAvant, type SuiviPatient } from "../../../dossier/suivis";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";
import { LigneSuivi } from "../patients/liste-suivis";

export const metadata: Metadata = {
  title: "Suivis",
  robots: { index: false, follow: false },
};

export default async function Suivis({ params }: PageProps<"/[lang]/espace/suivis">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <CalendarClock className="h-6 w-6 text-red-600" aria-hidden />
        Suivis
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Contrôles et examens à prévoir. « Message WhatsApp » ouvre un rappel déjà rédigé ; cliquez ensuite
        « Relancé », puis « Fait » une fois le rendez-vous pris.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} />
      </Suspense>
    </div>
  );
}

async function Liste({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const aujourdhui = jourLocal(new Date());

  let suivis: SuiviPatient[] | null = null;
  try {
    suivis = await suivisAvant(ajouterJours(aujourdhui, 30));
  } catch (erreur) {
    console.error(erreur);
  }
  if (suivis === null) return <ErreurLecture />;

  const groupes = [
    { titre: "En retard", liste: suivis.filter((s) => s.echeance < aujourdhui) },
    {
      titre: "Dans les 7 jours",
      liste: suivis.filter((s) => s.echeance >= aujourdhui && s.echeance <= ajouterJours(aujourdhui, 7)),
    },
    { titre: "Dans le mois", liste: suivis.filter((s) => s.echeance > ajouterJours(aujourdhui, 7)) },
  ];

  return (
    <div className="mt-8 space-y-8">
      {groupes.map((g) => (
        <section key={g.titre}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {g.titre} ({g.liste.length})
          </h2>
          {g.liste.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Aucun.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4 text-sm">
              {g.liste.map((s) => (
                <LigneSuivi key={s.id} langue={langue} suivi={s} aujourdhui={aujourdhui} avecPatient />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

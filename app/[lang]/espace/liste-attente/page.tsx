import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Hourglass } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { quand } from "../../../agenda/notification";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { listerAttente, listerCreneauxLibres, type Attente, type CreneauLibere } from "../../../dossier/liste-attente";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";
import { BoutonCreneau, BoutonsAttente, FormulaireAttente } from "./formulaires";

export const metadata: Metadata = {
  title: "Liste d'attente",
  robots: { index: false, follow: false },
};

export default async function ListeAttente({ params }: PageProps<"/[lang]/espace/liste-attente">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Hourglass className="h-6 w-6 text-red-600" aria-hidden />
        Liste d&apos;attente
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Les patients qui veulent un créneau plus tôt. Quand un rendez-vous est annulé, son créneau apparaît ici : « Prévenir »
        prépare le message pour le patient (WhatsApp ou e-mail), à envoyer d&apos;un clic.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

async function Contenu({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let attente: Attente[];
  let creneaux: CreneauLibere[];
  try {
    [attente, creneaux] = await Promise.all([listerAttente(), listerCreneauxLibres()]);
  } catch (erreur) {
    console.error(erreur);
    return <ErreurLecture />;
  }
  return (
    <>
      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">
          Créneaux libérés <span className="font-normal text-slate-400">({creneaux.length})</span>
        </h2>
        {creneaux.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun créneau libéré à proposer.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {creneaux.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  <span className="font-medium text-slate-900 first-letter:capitalize">{quand(c.debut)}</span>
                  {c.medecin && ` · Dr ${c.medecin}`}
                  <span className="text-slate-400"> · {c.origine}</span>
                </span>
                <BoutonCreneau langue={langue} id={c.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">
          En attente <span className="font-normal text-slate-400">({attente.length})</span>
        </h2>
        {attente.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Personne sur la liste.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {attente.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {a.nom.toUpperCase()} {a.prenom}
                  </p>
                  <p className="text-xs text-slate-500">{[a.telephone, a.email].filter(Boolean).join(" · ")}</p>
                  {a.souhait && <p className="mt-0.5 text-slate-600">{a.souhait}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">
                    Inscrit le {a.creeLe.toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })}
                    {a.prevenuLe && ` · prévenu le ${a.prevenuLe.toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })}`}
                  </p>
                </div>
                <BoutonsAttente langue={langue} id={a.id} prevenu={Boolean(a.prevenuLe)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Ajouter un patient</h2>
        <FormulaireAttente langue={langue} />
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { FilePen, Search, UserPlus } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { derniersDossiers, type DossierRecent } from "../../../dossier/journal";
import { age, libellePatient, rechercherPatients, type ResumePatient } from "../../../dossier/patients";
import { BaseNonConfiguree, ErreurLecture } from "./commun";

export const metadata: Metadata = {
  title: "Patients",
  robots: { index: false, follow: false },
};

export default async function Patients({ params, searchParams }: PageProps<"/[lang]/espace/patients">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${lang}/espace/patients/fiche`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FilePen className="h-4 w-4" aria-hidden />
            Fiche papier vierge
          </Link>
          <Link
            href={`/${lang}/espace/patients/nouveau`}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Nouveau patient
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Liste({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/patients">["searchParams"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  const q = String((await searchParams).q ?? "").slice(0, 100);

  let patients: ResumePatient[] | null = null;
  let recents: DossierRecent[] = [];
  if (baseConfiguree()) {
    try {
      patients = await rechercherPatients(q);
      // Sans recherche : les dossiers que ce compte a ouverts en dernier, pour reprendre où l'on s'était arrêté
      if (!q) recents = await derniersDossiers(utilisateur.identifiant, 8).catch(() => []);
    } catch (erreur) {
      console.error(erreur);
    }
  }
  const aujourdhui = jourLocal(new Date());
  const date = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);

  return (
    <>
      <form role="search" className="mt-6 flex gap-2">
        <label htmlFor="recherche" className="sr-only">
          Rechercher un patient
        </label>
        <input
          id="recherche"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          placeholder="Nom, prénom, téléphone ou n° de dossier"
          className="block w-full rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Search className="h-4 w-4" aria-hidden />
          Rechercher
        </button>
      </form>

      {recents.length > 0 && (
        <section aria-label="Dossiers ouverts récemment" className="mt-6">
          <p className="text-sm text-slate-500">Dossiers ouverts récemment</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recents.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/${langue}/espace/patients/${d.id}`}
                  className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-800 hover:bg-slate-50"
                >
                  {libellePatient(d)}
                  <span className="ms-2 text-xs text-slate-400">n° {d.id}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!baseConfiguree() ? (
        <BaseNonConfiguree />
      ) : patients === null ? (
        <ErreurLecture />
      ) : patients.length === 0 ? (
        <p className="mt-8 text-slate-500">
          {q ? (
            <>
              Aucun dossier ne correspond à « {q} ».{" "}
              <Link href={`/${langue}/espace/patients/nouveau`} className="text-red-700 underline">
                Créer un nouveau dossier
              </Link>
            </>
          ) : (
            "Aucun dossier pour le moment."
          )}
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-500">
            {q ? `${patients.length} résultat${patients.length > 1 ? "s" : ""}` : "Dossiers modifiés récemment"}
          </p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {patients.map((p) => {
              const ans = age(p.naissance, aujourdhui);
              return (
                <li key={p.id}>
                  <Link
                    href={`/${langue}/espace/patients/${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-medium text-slate-900">{libellePatient(p)}</span>
                      <span className="ms-2 text-slate-400">n° {p.id}</span>
                      <span className="ms-3 text-slate-500">
                        {[p.sexe === "F" ? "F" : p.sexe === "M" ? "H" : "", ans !== null ? `${ans} ans` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex gap-4 text-slate-500">
                      {p.telephone && <span>{p.telephone}</span>}
                      <span className="hidden sm:inline">modifié le {date(p.modifieLe)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

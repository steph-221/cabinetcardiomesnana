import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Search, UserPlus } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { age, libellePatient, rechercherPatients, type ResumePatient } from "../../../dossier/patients";
import { BaseNonConfiguree, ErreurLecture, Retour } from "./commun";

export const metadata: Metadata = {
  title: "Patients",
  robots: { index: false, follow: false },
};

export default async function Patients({ params, searchParams }: PageProps<"/[lang]/espace/patients">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace`}>Retour à l&apos;agenda</Retour>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
        <Link
          href={`/${lang}/espace/patients/nouveau`}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Nouveau patient
        </Link>
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
  await exigerUtilisateur(langue);
  const q = String((await searchParams).q ?? "").slice(0, 100);

  let patients: ResumePatient[] | null = null;
  if (baseConfiguree()) {
    try {
      patients = await rechercherPatients(q);
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

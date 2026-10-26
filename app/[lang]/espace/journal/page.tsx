import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { cabinet, estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { lireJournal, type Entree } from "../../../dossier/journal";
import { BaseNonConfiguree, ErreurLecture, Retour } from "../patients/commun";

export const metadata: Metadata = {
  title: "Journal des accès",
  robots: { index: false, follow: false },
};

export default async function Journal({ params, searchParams }: PageProps<"/[lang]/espace/journal">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace`}>Retour à l&apos;agenda</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Journal des accès aux dossiers</h1>
      <p className="mt-1 text-sm text-slate-500">
        Qui a ouvert, créé ou modifié un dossier, et quand. Les 200 dernières entrées.
      </p>
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
  searchParams: PageProps<"/[lang]/espace/journal">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "admin");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const patient = Number((await searchParams).patient);
  const patientId = Number.isInteger(patient) && patient > 0 ? patient : null;

  let entrees: Entree[] | null = null;
  try {
    entrees = await lireJournal(patientId);
  } catch (erreur) {
    console.error(erreur);
  }
  if (entrees === null) return <ErreurLecture />;
  const quand = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: cabinet.fuseau }).format(d);

  return (
    <>
      {patientId && (
        <p className="mt-6 text-sm">
          Dossier n° {patientId} seulement ·{" "}
          <Link href={`/${langue}/espace/journal`} className="text-red-700 underline">
            tout afficher
          </Link>
        </p>
      )}
      {entrees.length === 0 ? (
        <p className="mt-8 text-slate-500">Aucune entrée.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 font-medium">Quand</th>
                <th className="p-3 font-medium">Qui</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entrees.map((e, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap p-3 text-slate-600">{quand(e.quand)}</td>
                  <td className="p-3 text-slate-900">{e.qui}</td>
                  <td className="p-3 text-slate-900">
                    {e.action}
                    {e.detail && <span className="ms-2 text-slate-500">{e.detail}</span>}
                  </td>
                  <td className="p-3">
                    {e.patientId && (
                      <Link href={`/${langue}/espace/patients/${e.patientId}`} className="text-red-700 hover:underline">
                        n° {e.patientId}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

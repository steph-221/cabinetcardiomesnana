import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Library, MessagesSquare, ThumbsDown, ThumbsUp, UserRound } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { claudeConfigure } from "../../../dossier/dictee";
import { libellePatient, lirePatient } from "../../../dossier/patients";
import { listerQuestions, resumeClinique, type Question } from "../../../dossier/questions";
import { BaseNonConfiguree, ErreurLecture, Retour } from "../patients/commun";
import { FormulaireQuestion } from "./formulaires";

export const metadata: Metadata = {
  title: "Assistant de cardiologie",
  robots: { index: false, follow: false },
};

export default async function Assistant({ params, searchParams }: PageProps<"/[lang]/espace/assistant">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace`}>Retour à l&apos;agenda</Retour>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <MessagesSquare className="h-6 w-6 text-red-600" aria-hidden />
          Assistant de cardiologie
        </h1>
        <Link
          href={`/${lang}/espace/bibliotheque`}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Library className="h-4 w-4" aria-hidden />
          Bibliothèque
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Il répond uniquement à partir des sources de la bibliothèque, et chaque affirmation renvoie au passage cité.
        Vérifiez toujours la source avant de décider.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenu({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/assistant">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const brut = Number((await searchParams).patient);
  const patientId = Number.isInteger(brut) && brut > 0 ? brut : null;

  let questions: Question[] | null = null;
  let patient: Awaited<ReturnType<typeof lirePatient>> = null;
  let contexte: string | null = null;
  try {
    [questions, patient, contexte] = await Promise.all([
      listerQuestions(),
      patientId ? lirePatient(patientId) : null,
      patientId ? resumeClinique(patientId) : null,
    ]);
  } catch (erreur) {
    console.error(erreur);
  }
  if (questions === null) return <ErreurLecture />;

  return (
    <>
      <section className="mt-6 rounded-2xl border border-slate-200 p-6">
        {!claudeConfigure() && (
          <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            L&apos;assistant a besoin d&apos;une clé Anthropic : ajoutez la variable ANTHROPIC_API_KEY dans Vercel (voir
            DOSSIER.md).
          </p>
        )}
        {patient && contexte && (
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-slate-800">
              <UserRound className="h-4 w-4" aria-hidden />
              Question sur le dossier de {libellePatient(patient)}
              <Link href={`/${langue}/espace/assistant`} className="ms-auto text-xs font-normal text-red-700 underline">
                Question générale
              </Link>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Ce résumé anonyme (sans nom ni coordonnées) est joint à la question :
            </p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-slate-700">{contexte}</pre>
          </div>
        )}
        <FormulaireQuestion langue={langue} patientId={patient ? patient.id : null} />
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">Questions récentes</h2>
        {questions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucune question pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {questions.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/${langue}/espace/assistant/${q.id}`}
                  className="flex items-start justify-between gap-3 p-3 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-slate-900">{q.question}</span>
                    <span className="text-xs text-slate-500">
                      {q.creeLe.toLocaleString("fr-FR", {
                        timeZone: "Africa/Casablanca",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      · {q.creePar}
                      {q.patientId ? " · depuis un dossier" : ""}
                      {q.reponse.sansReponse ? " · pas de réponse dans la bibliothèque" : ""}
                    </span>
                  </span>
                  {q.note === 1 && <ThumbsUp className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Juste" />}
                  {q.note === -1 && <ThumbsDown className="h-4 w-4 shrink-0 text-red-600" aria-label="À revoir" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

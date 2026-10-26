import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ExternalLink, Library, MessagesSquare } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { libelleSource, listerSources, typesSource, type Source } from "../../../dossier/bibliotheque";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";
import { BoutonsSource, ImportSource } from "./import";

export const metadata: Metadata = {
  title: "Bibliothèque de références",
  robots: { index: false, follow: false },
};

export default async function Bibliotheque({ params }: PageProps<"/[lang]/espace/bibliotheque">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Library className="h-6 w-6 text-red-600" aria-hidden />
          Bibliothèque de références
        </h1>
        <Link
          href={`/${lang}/espace/assistant`}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <MessagesSquare className="h-4 w-4" aria-hidden />
          Assistant
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Les sources dans lesquelles l&apos;assistant cherche ses réponses. Il ne cite que les sources en vigueur : quand
        une recommandation paraît, ajoutez-la et marquez l&apos;ancienne « remplacée ». Les recommandations de
        l&apos;ESC se téléchargent sur{" "}
        <a
          href="https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-700 underline"
        >
          escardio.org
        </a>{" "}
        (usage interne au cabinet).
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

async function Contenu({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let sources: Source[] | null = null;
  try {
    sources = await listerSources();
  } catch (erreur) {
    console.error(erreur);
  }
  if (sources === null) return <ErreurLecture />;
  const libelleType = (t: string) => typesSource.find((x) => x.cle === t)?.libelle ?? t;

  return (
    <>
      <section className="mt-6 rounded-2xl border border-slate-200 p-6">
        <h2 className="mb-4 font-semibold text-slate-900">Ajouter une source</h2>
        <ImportSource langue={langue} />
      </section>
      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">
          Sources <span className="font-normal text-slate-400">({sources.length})</span>
        </h2>
        {sources.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            La bibliothèque est vide : l&apos;assistant répondra « Pas de réponse dans la bibliothèque » tant
            qu&apos;aucune source n&apos;y est ajoutée.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p
                    className={`font-medium ${s.statut === "remplacee" ? "text-slate-400 line-through" : "text-slate-900"}`}
                  >
                    {libelleSource(s)}
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ms-2 inline-flex text-red-700"
                        aria-label="Ouvrir la version officielle"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {[
                      libelleType(s.type),
                      s.langue === "en" ? "anglais" : "français",
                      s.pages ? `${s.pages} page(s)` : "",
                      `${s.passages} passages`,
                      s.statut === "remplacee" ? "remplacée : n'est plus citée" : "",
                      s.complete ? "" : "import inachevé",
                      `ajoutée le ${s.creeLe.toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })} par ${s.creePar}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <BoutonsSource langue={langue} id={s.id} statut={s.statut} titre={s.titre} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

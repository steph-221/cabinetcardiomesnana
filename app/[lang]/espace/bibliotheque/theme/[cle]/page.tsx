import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BookCheck, ExternalLink, FileText, Library, MessagesSquare } from "lucide-react";
import { estLangue } from "../../../../../cabinet";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { baseConfiguree } from "../../../../../dossier/base";
import { libelleSource, listerSources, type Source } from "../../../../../dossier/bibliotheque";
import { lienDoi } from "../../../../../dossier/resolution";
import { estTheme, libelleTheme, themesDe } from "../../../../../dossier/themes";
import { listerSites, type SiteSuivi } from "../../../../../dossier/veille";
import { BaseNonConfiguree, ErreurLecture, Retour } from "../../../patients/commun";
import { Categories } from "../../categories";

export const metadata: Metadata = {
  title: "Thème de la bibliothèque",
  robots: { index: false, follow: false },
};

export default function Theme({ params }: PageProps<"/[lang]/espace/bibliotheque/theme/[cle]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Page params={params} />
      </Suspense>
    </div>
  );
}

async function Page({ params }: { params: PageProps<"/[lang]/espace/bibliotheque/theme/[cle]">["params"] }) {
  const { lang, cle } = await params;
  if (!estLangue(lang) || !estTheme(cle)) notFound();
  return (
    <>
      <Retour href={`/${lang}/espace/bibliotheque`}>Retour à la bibliothèque</Retour>
      <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Library className="h-6 w-6 text-red-600" aria-hidden />
        {libelleTheme(cle)}
      </h1>
      <Categories langue={lang} active="documents" />
      <Contenu langue={lang} cle={cle} />
    </>
  );
}

async function Contenu({ langue, cle }: { langue: string; cle: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let sources: Source[];
  let sites: SiteSuivi[];
  try {
    [sources, sites] = await Promise.all([listerSources(), listerSites()]);
  } catch (erreur) {
    console.error(erreur);
    return <ErreurLecture />;
  }
  const duTheme = (texte: string) => themesDe(texte).includes(cle as never);
  const docs = sources.filter((s) => duTheme(s.titre));
  const enVigueur = docs.filter((s) => s.statut === "en_vigueur");
  const remplacees = docs.filter((s) => s.statut === "remplacee");
  const publications = sites
    .flatMap((s) => s.publications.map((p) => ({ ...p, site: s.nom })))
    .filter((p) => p.etat !== "ecartee" && !p.importee && duTheme(`${p.titre} ${p.resume}`))
    .sort((a, b) => (b.publieLe ?? b.vueLe).getTime() - (a.publieLe ?? a.vueLe).getTime())
    .slice(0, 15);

  return (
    <>
      <p className="mt-4">
        <Link
          href={`/${langue}/espace/assistant`}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <MessagesSquare className="h-4 w-4" aria-hidden />
          Poser une question à l&apos;assistant
        </Link>
      </p>

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">
          En vigueur <span className="font-normal text-slate-400">({enVigueur.length})</span>
        </h2>
        {enVigueur.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aucun document de ce thème dans la bibliothèque. Les publications à ajouter sont listées plus bas.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {enVigueur.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="font-medium text-slate-900">{libelleSource(s)}</span>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-red-700">
                    <ExternalLink className="h-3 w-3" aria-hidden />
                    Version officielle
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">
          À ajouter ou à lire <span className="font-normal text-slate-400">({publications.length})</span>
        </h2>
        {publications.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune publication suivie sur ce thème pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {publications.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:text-red-700 hover:underline">
                    {p.titre}
                  </a>
                  {p.etat === "a_lire" && <span className="ms-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">À lire</span>}
                  <p className="text-xs text-slate-500">
                    {p.site}
                    {p.doi && (
                      <>
                        {" · "}
                        <a href={lienDoi(p.doi)} target="_blank" rel="noopener noreferrer" className="text-red-700 underline">
                          DOI
                        </a>
                      </>
                    )}
                    {p.pdfUrl && (
                      <>
                        {" · "}
                        <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-red-700 underline">
                          <FileText className="h-3 w-3" aria-hidden />
                          PDF libre
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <Link href={`/${langue}/espace/bibliotheque?publication=${p.id}#ajouter`} className="text-xs text-red-700 hover:underline">
                  Ajouter à la bibliothèque
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {remplacees.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">
            Versions remplacées <span className="font-normal text-slate-400">({remplacees.length})</span>
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm text-slate-400">
            {remplacees.map((s) => (
              <li key={s.id} className="flex items-center gap-2 p-3 line-through">
                <BookCheck className="h-3 w-3" aria-hidden />
                {libelleSource(s)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">N&apos;est plus citée par l&apos;assistant.</p>
        </section>
      )}
    </>
  );
}

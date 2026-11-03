import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { ExternalLink, Library } from "lucide-react";
import { estLangue } from "../../../../../cabinet";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { libelleSource, lienPage, lirePassage } from "../../../../../dossier/bibliotheque";
import { Surligne } from "../../../surligne";

export const metadata: Metadata = {
  title: "Passage de la bibliothèque",
  robots: { index: false, follow: false },
};

// Le passage cité par un compte rendu ou par la vérification des seuils : texte de la source, phrase surlignée, lien
// vers le document à la bonne page. « ?cite= » donne la phrase à surligner.
export default async function PassagePage({
  params,
  searchParams,
}: PageProps<"/[lang]/espace/bibliotheque/passage/[id]">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenu({
  langue,
  params,
  searchParams,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/bibliotheque/passage/[id]">["params"];
  searchParams: PageProps<"/[lang]/espace/bibliotheque/passage/[id]">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const passage = Number.isInteger(id) && id > 0 ? await lirePassage(id) : null;
  if (!passage) notFound();
  const cite = (await searchParams).cite;
  const extraits = typeof cite === "string" && cite ? [cite.slice(0, 600)] : [];

  return (
    <>
      <Link href={`/${langue}/espace/bibliotheque`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <Library className="h-4 w-4" aria-hidden />
        Bibliothèque
      </Link>
      <h1 className="mt-4 text-xl font-bold text-slate-900">{libelleSource(passage.source)}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        {passage.page && <span>Page {passage.page}</span>}
        {passage.source.url && (
          <a
            href={lienPage(passage.source.url, passage.page)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-red-700 underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            {passage.page ? `Ouvrir le document à la page ${passage.page}` : "Ouvrir le document"}
          </a>
        )}
      </p>
      <p className="mt-5 whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-relaxed text-slate-800">
        <Surligne texte={passage.texte} extraits={extraits} />
      </p>
      <p className="mt-3 text-xs text-slate-500">
        Texte extrait du document pour la recherche ; en cas de doute, relisez la page dans le document d&apos;origine.
      </p>
    </>
  );
}

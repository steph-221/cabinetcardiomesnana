import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { ExternalLink, FolderOpen, TriangleAlert } from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import type { Reponse } from "../../../../dossier/assistant";
import { lienPage } from "../../../../dossier/sources";
import { lireQuestion } from "../../../../dossier/questions";
import { Retour } from "../../patients/commun";
import { Notation } from "../formulaires";

export const metadata: Metadata = {
  title: "Réponse de l'assistant",
  robots: { index: false, follow: false },
};

export default async function ReponseAssistant({ params }: PageProps<"/[lang]/espace/assistant/[id]">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/assistant`}>Assistant</Retour>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} params={params} />
      </Suspense>
    </div>
  );
}

// Le texte de l'assistant peut contenir un peu de Markdown : on garde les retours à la ligne et les listes,
// sans les marques de gras ni de titre
const sansMarkdown = (t: string) => t.replace(/\*\*|__/g, "").replace(/^#{1,6} +/gm, "");

// Passage avec les extraits cités surlignés
function Surligne({ texte, extraits }: { texte: string; extraits: string[] }) {
  const zones = extraits
    .flatMap((e) => {
      const debut = e ? texte.indexOf(e) : -1;
      return debut < 0 ? [] : [[debut, debut + e.length] as const];
    })
    .sort((a, b) => a[0] - b[0]);
  const morceaux: React.ReactNode[] = [];
  let curseur = 0;
  for (const [debut, fin] of zones) {
    if (fin <= curseur) continue;
    const d = Math.max(debut, curseur);
    if (d > curseur) morceaux.push(texte.slice(curseur, d));
    morceaux.push(
      <mark key={d} className="rounded bg-amber-100 px-0.5 text-slate-900">
        {texte.slice(d, fin)}
      </mark>,
    );
    curseur = fin;
  }
  morceaux.push(texte.slice(curseur));
  return <>{morceaux}</>;
}

async function Contenu({
  langue,
  params,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/assistant/[id]">["params"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const question = Number.isInteger(id) && id > 0 ? await lireQuestion(id) : null;
  if (!question) notFound();
  const reponse: Reponse = question.reponse;

  // Numérotation des passages dans l'ordre de leur première citation
  const numeros = new Map<number, number>();
  for (const b of reponse.blocs)
    for (const c of b.citations) if (!numeros.has(c.passage)) numeros.set(c.passage, numeros.size + 1);
  const cites = [...numeros.entries()].map(([passage, numero]) => ({
    numero,
    passage: reponse.passages[passage],
    extraits: reponse.blocs.flatMap((b) => b.citations.filter((c) => c.passage === passage).map((c) => c.cite)),
  }));
  const nonSource = reponse.blocs.some((b) => !b.citations.length && b.texte.trim().length > 60);

  return (
    <>
      <h1 className="mt-4 text-xl font-bold text-slate-900">{question.question}</h1>
      <p className="mt-1 text-xs text-slate-500">
        {question.creeLe.toLocaleString("fr-FR", {
          timeZone: "Africa/Casablanca",
          dateStyle: "long",
          timeStyle: "short",
        })}{" "}
        · {question.creePar}
        {question.patientId && (
          <>
            {" · "}
            <Link
              href={`/${langue}/espace/patients/${question.patientId}`}
              className="inline-flex items-center gap-1 text-red-700 underline"
            >
              <FolderOpen className="h-3 w-3" aria-hidden />
              dossier n° {question.patientId}
            </Link>
          </>
        )}
      </p>

      <section
        className={`mt-6 rounded-2xl border p-6 ${reponse.sansReponse ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}
      >
        <div className="whitespace-pre-wrap text-[15px] leading-7 text-slate-900">
          {reponse.blocs.map((b, i) =>
            b.citations.length ? (
              <span key={i}>
                {sansMarkdown(b.texte)}
                {[...new Set(b.citations.map((c) => numeros.get(c.passage)!))].map((n) => (
                  <a
                    key={n}
                    href={`#ref-${n}`}
                    className="ms-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-50 px-1 align-super text-[11px] font-semibold text-red-700 hover:bg-red-100"
                    aria-label={`Source ${n}`}
                  >
                    {n}
                  </a>
                ))}
              </span>
            ) : (
              <span key={i} className={b.texte.trim().length > 60 ? "text-slate-500" : undefined}>
                {sansMarkdown(b.texte)}
              </span>
            ),
          )}
        </div>
        {nonSource && !reponse.sansReponse && (
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
            Le texte en gris n&apos;est rattaché à aucune source : ne vous y fiez pas sans vérifier.
          </p>
        )}
        {reponse.sansReponse && (
          <p className="mt-4 text-sm text-amber-900">
            Ajoutez la source correspondante dans la{" "}
            <Link href={`/${langue}/espace/bibliotheque`} className="underline">
              bibliothèque
            </Link>
            , puis reposez la question.
          </p>
        )}
      </section>

      {reponse.contexte && (
        <details className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer text-slate-700">Résumé anonyme du patient joint à la question</summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-slate-700">{reponse.contexte}</pre>
        </details>
      )}

      {cites.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">Sources citées</h2>
          <ol className="mt-3 space-y-3">
            {cites.map(({ numero, passage, extraits }) => (
              <li
                key={numero}
                id={`ref-${numero}`}
                className="scroll-mt-6 rounded-xl border border-slate-200 p-4 text-sm target:border-red-300 target:ring-2 target:ring-red-100"
              >
                <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-50 px-1 text-xs font-semibold text-red-700">
                    {numero}
                  </span>
                  {passage.source.libelle}
                  {passage.page && <span className="font-normal text-slate-500">p. {passage.page}</span>}
                  {passage.source.url && (
                    <a
                      href={lienPage(passage.source.url, passage.page)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ms-auto inline-flex items-center gap-1 text-xs font-normal text-red-700 underline"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      {passage.page ? `Ouvrir à la page ${passage.page}` : "Ouvrir la source"}
                    </a>
                  )}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">
                  <Surligne texte={passage.texte} extraits={extraits} />
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-slate-200 p-6">
        <h2 className="mb-3 font-semibold text-slate-900">Votre avis sur cette réponse</h2>
        <Notation
          langue={langue}
          id={question.id}
          note={question.note}
          commentaire={question.commentaire}
          fiche={Boolean(question.ficheId)}
          peutFaireFiche={!reponse.sansReponse && cites.length > 0}
        />
      </section>

      {reponse.termes.en.length + reponse.termes.fr.length > 0 && (
        <p className="mt-6 text-xs text-slate-400">
          Recherche : {[...reponse.termes.en, ...reponse.termes.fr].join(", ")} · {reponse.passages.length} passage(s)
          examiné(s)
        </p>
      )}
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import { trouverCalculateur } from "../../../../dossier/calculateurs";
import { CalculateurInteractif } from "../calculateur";

export const metadata: Metadata = {
  title: "Calculateur",
  robots: { index: false, follow: false },
};

export default async function PageCalculateur({ params }: PageProps<"/[lang]/espace/calculateurs/[slug]">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Link href={`/${lang}/espace/calculateurs`} className="text-sm text-slate-500 hover:text-slate-800">
        ← Calculateurs
      </Link>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} params={params} />
      </Suspense>
    </div>
  );
}

async function Contenu({
  langue,
  params,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/calculateurs/[slug]">["params"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const calculateur = trouverCalculateur((await params).slug);
  if (!calculateur) notFound();

  return (
    <>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{calculateur.titre}</h1>
      <p className="mt-1 text-sm text-slate-500">{calculateur.resume}</p>
      <section className="mt-6 rounded-2xl border border-slate-200 p-6 text-sm">
        <CalculateurInteractif slug={calculateur.slug} />
      </section>
      {calculateur.notes?.map((n) => (
        <p key={n} className="mt-3 text-xs text-slate-500">
          {n}
        </p>
      ))}
      <p className="mt-3 text-xs text-slate-500">
        Source :{" "}
        {calculateur.source.url ? (
          <a href={calculateur.source.url} className="underline" target="_blank" rel="noreferrer">
            {calculateur.source.libelle}
          </a>
        ) : (
          calculateur.source.libelle
        )}
        . {calculateur.verification}
      </p>
    </>
  );
}

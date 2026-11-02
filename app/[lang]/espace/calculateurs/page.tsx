import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { calculateurs } from "../../../dossier/calculateurs";

export const metadata: Metadata = {
  title: "Calculateurs cardiologiques",
  robots: { index: false, follow: false },
};

export default async function Calculateurs({ params }: PageProps<"/[lang]/espace/calculateurs">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Calculator className="h-6 w-6 text-red-600" aria-hidden />
        Calculateurs
      </h1>
      <p className="mt-1 text-sm text-slate-500">Scores et formules cardiologiques. Ce sont des aides : le médecin garde la décision.</p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} />
      </Suspense>
    </div>
  );
}

async function Liste({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  return (
    <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
      {calculateurs.map((c) => (
        <li key={c.slug}>
          <Link href={`/${langue}/espace/calculateurs/${c.slug}`} className="block p-4 hover:bg-slate-50">
            <span className="font-semibold text-slate-900">{c.titre}</span>
            <span className="mt-0.5 block text-slate-600">{c.resume}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

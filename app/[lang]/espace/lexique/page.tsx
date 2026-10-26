import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { BookA } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { lireLexique, type EntreeLexique } from "../../../dossier/lexique";
import { BaseNonConfiguree, ErreurLecture, Retour } from "../patients/commun";
import { BoutonRetirerMot, FormulaireMot } from "./formulaires";

export const metadata: Metadata = {
  title: "Lexique de la dictée",
  robots: { index: false, follow: false },
};

export default async function Lexique({ params }: PageProps<"/[lang]/espace/lexique">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace`}>Retour à l&apos;agenda</Retour>
      <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <BookA className="h-6 w-6 text-red-600" aria-hidden />
        Lexique de la dictée
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Les mots que la reconnaissance vocale comprend mal, et leur forme correcte. Ils sont ajoutés depuis la relecture
        d&apos;une dictée ou ici, et servent à toutes les dictées suivantes.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} />
      </Suspense>
    </div>
  );
}

async function Liste({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let lexique: EntreeLexique[] | null = null;
  try {
    lexique = await lireLexique();
  } catch (erreur) {
    console.error(erreur);
  }
  if (lexique === null) return <ErreurLecture />;

  return (
    <>
      <section className="mt-6 rounded-2xl border border-slate-200 p-6">
        <FormulaireMot langue={langue} />
      </section>
      {lexique.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Aucun mot pour le moment.</p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {lexique.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 p-3">
              <span>
                <span className="text-slate-500 line-through">{l.entendu}</span>
                <span className="mx-2 text-slate-400">→</span>
                <span className="font-medium text-slate-900">{l.correct}</span>
              </span>
              <BoutonRetirerMot langue={langue} id={l.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

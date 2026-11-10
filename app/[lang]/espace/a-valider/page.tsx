import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CheckCheck, ChevronRight } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { jourLocal } from "../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../agenda/session";
import { groupesAValider, total } from "../../../dossier/a-valider";
import { baseConfiguree } from "../../../dossier/base";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";

export const metadata: Metadata = {
  title: "À valider",
  robots: { index: false, follow: false },
};

export default async function AValider({ params }: PageProps<"/[lang]/espace/a-valider">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <CheckCheck className="h-6 w-6 text-red-600" aria-hidden />À valider
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Tout ce que le site a préparé et qui attend un coup d&apos;œil : rien n&apos;entre dans un dossier sans validation.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} />
      </Suspense>
    </div>
  );
}

async function Liste({ langue }: { langue: string }) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const medical = accesMedical(utilisateur);
  let groupes;
  try {
    groupes = (await groupesAValider(jourLocal(new Date()), medical)).filter((g) => medical || !g.medical);
  } catch (erreur) {
    console.error(erreur);
    return <ErreurLecture />;
  }
  const attente = groupes.filter((g) => g.n > 0);
  return (
    <>
      <p className="mt-6 text-sm font-medium text-slate-700">
        {total(groupes) === 0 ? "Rien en attente." : `${total(groupes)} élément(s) en attente.`}
      </p>
      <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        {(attente.length ? attente : groupes).map((g) => (
          <li key={g.cle}>
            <Link href={`/${langue}/espace${g.chemin}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50">
              <span className={g.n > 0 ? "text-slate-900" : "text-slate-400"}>{g.libelle}</span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.n > 0 ? "bg-red-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                  {g.n}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

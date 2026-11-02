import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { jourLocal } from "../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { listerCharges, listerPraticiens, type Charge } from "../../../../dossier/compta";
import { bornes, libelleMode, mad, periodeValide, periodeVoisine, titrePeriode } from "../../../../dossier/compta-calculs";
import { BaseNonConfiguree, ErreurLecture } from "../../patients/commun";
import { BoutonRetirerCharge, FormulaireCharge } from "../formulaires";

export const metadata: Metadata = {
  title: "Charges du cabinet",
  robots: { index: false, follow: false },
};

export default async function Charges({ params, searchParams }: PageProps<"/[lang]/espace/comptabilite/charges">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6" lang="fr" dir="ltr">
      <h1 className="text-2xl font-bold text-slate-900">Charges du cabinet</h1>
      <p className="mt-1 text-sm text-slate-500">
        Loyer, salaires, fournitures, entretien des appareils… Une charge est soit commune (partagée entre les médecins
        selon leurs parts), soit à la charge d&apos;un seul médecin.
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
  searchParams: PageProps<"/[lang]/espace/comptabilite/charges">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;

  const aujourdhui = jourLocal(new Date());
  const demande = String((await searchParams).p ?? "");
  const periode = periodeValide(demande) ? demande : aujourdhui.slice(0, 7);
  const { du, au } = bornes(periode);

  let charges: Charge[] | null = null;
  let praticiens: Awaited<ReturnType<typeof listerPraticiens>> = [];
  try {
    [charges, praticiens] = await Promise.all([listerCharges(du, au), listerPraticiens()]);
  } catch (erreur) {
    console.error(erreur);
  }
  if (charges === null) return <ErreurLecture />;

  const base = `/${langue}/espace/comptabilite/charges`;
  const total = charges.reduce((s, c) => s + c.montantCts, 0);
  const jour = (d: string) => d.split("-").reverse().join("/");

  return (
    <>
      <section className="mt-6 rounded-2xl border border-slate-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Ajouter une charge</h2>
        <FormulaireCharge
          langue={langue}
          praticiens={praticiens.filter((p) => p.actif).map((p) => ({ id: p.id, nom: p.nom }))}
          aujourdhui={aujourdhui}
        />
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 first-letter:capitalize">
          {titrePeriode(periode)} · {mad(total)}
        </h2>
        <div className="flex items-center gap-2">
          <Link href={`${base}?p=${periodeVoisine(periode, -1)}`} aria-label="Mois précédent" className="rounded-full border border-slate-300 p-2 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={`${base}?p=${periodeVoisine(periode, 1)}`} aria-label="Mois suivant" className="rounded-full border border-slate-300 p-2 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {charges.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Aucune charge ce mois-ci.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Libellé</th>
                <th className="px-4 py-2 font-medium">Catégorie</th>
                <th className="px-4 py-2 font-medium">À la charge de</th>
                <th className="px-4 py-2 text-right font-medium">Montant</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{jour(c.date)}</td>
                  <td className="px-4 py-3">
                    {c.libelle}
                    <span className="block text-xs text-slate-500">
                      {[c.fournisseur, libelleMode(c.mode)].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.categorie}</td>
                  <td className="px-4 py-3 text-slate-600">{c.praticienNom ?? "Cabinet (commun)"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{mad(c.montantCts)}</td>
                  <td className="px-2 py-3 text-right">
                    <BoutonRetirerCharge langue={langue} id={c.id} />
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

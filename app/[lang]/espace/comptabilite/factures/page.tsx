import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Plus, Search } from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { listerFactures, type Facture } from "../../../../dossier/compta";
import { bornes, libelleStatut, mad, periodeValide, titrePeriode, type StatutFacture } from "../../../../dossier/compta-calculs";
import { BaseNonConfiguree, ErreurLecture } from "../../patients/commun";
import { couleurStatut } from "../commun";

export const metadata: Metadata = {
  title: "Factures",
  robots: { index: false, follow: false },
};

type Filtre = StatutFacture | "ouvertes";
const filtres: { valeur: Filtre | ""; libelle: string }[] = [
  { valeur: "", libelle: "Toutes" },
  { valeur: "ouvertes", libelle: "À encaisser" },
  { valeur: "payee", libelle: "Payées" },
  { valeur: "annulee", libelle: "Annulées" },
];

export default async function Factures({ params, searchParams }: PageProps<"/[lang]/espace/comptabilite/factures">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" lang="fr" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Factures</h1>
        <Link
          href={`/${lang}/espace/comptabilite/factures/nouvelle`}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nouvelle facture
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Liste({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/comptabilite/factures">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 100);
  const statutDemande = String(params.statut ?? "");
  const statut = filtres.some((f) => f.valeur === statutDemande) ? (statutDemande as Filtre | "") : "";
  const p = String(params.p ?? "");
  const periode = periodeValide(p) ? p : "";
  const patient = Number(params.patient);
  const patientId = Number.isInteger(patient) && patient > 0 ? patient : undefined;

  let factures: Facture[] | null = null;
  try {
    const toutes = await listerFactures({
      recherche: q || undefined,
      patientId,
      ...(periode ? bornes(periode) : {}),
      statut: statut && statut !== "ouvertes" ? statut : undefined,
    });
    factures = statut === "ouvertes" ? toutes.filter((f) => f.statut === "impayee" || f.statut === "partielle") : toutes;
  } catch (erreur) {
    console.error(erreur);
  }
  if (factures === null) return <ErreurLecture />;

  const base = `/${langue}/espace/comptabilite/factures`;
  const lien = (s: string) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (s) u.set("statut", s);
    if (periode) u.set("p", periode);
    if (patientId) u.set("patient", String(patientId));
    return `${base}${u.size ? `?${u}` : ""}`;
  };
  const vivantes = factures.filter((f) => !f.annulee);
  const reste = vivantes.reduce((s, f) => s + f.totalCts - f.payeCts, 0);
  const jour = (d: string) => d.split("-").reverse().join("/");

  return (
    <>
      <form action={base} className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative">
          <span className="sr-only">Rechercher un patient ou un numéro</span>
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Patient ou n° de facture"
            className="w-64 rounded-full border border-slate-300 py-2 ps-9 pe-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </label>
        {statut && <input type="hidden" name="statut" value={statut} />}
        {periode && <input type="hidden" name="p" value={periode} />}
        {patientId && <input type="hidden" name="patient" value={patientId} />}
        <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Chercher
        </button>
        <nav aria-label="Filtrer par état" className="flex flex-wrap gap-1.5">
          {filtres.map((f) => (
            <Link
              key={f.valeur}
              href={lien(f.valeur)}
              aria-current={statut === f.valeur ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                statut === f.valeur ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {f.libelle}
            </Link>
          ))}
        </nav>
      </form>
      {(periode || patientId) && (
        <p className="mt-3 text-sm text-slate-600">
          {periode && <>Période : {titrePeriode(periode)} · </>}
          {patientId && <>Dossier n° {patientId} · </>}
          <Link href={base} className="text-red-700 underline">
            tout afficher
          </Link>
        </p>
      )}

      {factures.length === 0 ? (
        <p className="mt-8 text-slate-500">Aucune facture.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-500">
            {factures.length} facture{factures.length > 1 ? "s" : ""} · total {mad(vivantes.reduce((s, f) => s + f.totalCts, 0))}
            {reste > 0 && <> · reste à encaisser {mad(reste)}</>}
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">N°</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Patient</th>
                  <th className="px-4 py-2 font-medium">Médecin</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Reste</th>
                  <th className="px-4 py-2 font-medium">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {factures.map((f) => (
                  <tr key={f.id} className={f.annulee ? "text-slate-400" : ""}>
                    <td className="px-4 py-3 font-mono">
                      <Link href={`${base}/${f.id}`} className="text-red-700 hover:underline">
                        {f.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{jour(f.date)}</td>
                    <td className="px-4 py-3">{f.patientNom}</td>
                    <td className="px-4 py-3">{f.praticienNom}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{mad(f.totalCts)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{f.annulee ? "—" : mad(f.totalCts - f.payeCts)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${couleurStatut[f.statut]}`}>{libelleStatut[f.statut]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

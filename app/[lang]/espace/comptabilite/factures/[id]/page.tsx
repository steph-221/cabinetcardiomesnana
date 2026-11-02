import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { FileText, FolderOpen } from "lucide-react";
import { estLangue } from "../../../../../cabinet";
import { jourLocal } from "../../../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../../../agenda/session";
import { baseConfiguree } from "../../../../../dossier/base";
import { lireFacture } from "../../../../../dossier/compta";
import { libelleMode, libelleStatut, mad, totalLignes } from "../../../../../dossier/compta-calculs";
import { BaseNonConfiguree, Retour } from "../../../patients/commun";
import { BoutonRetirerPaiement, FormulaireAnnulation, FormulairePaiement } from "../../formulaires";
import { couleurStatut } from "../../commun";

export const metadata: Metadata = {
  title: "Facture",
  robots: { index: false, follow: false },
};

export default async function PageFacture({ params }: PageProps<"/[lang]/espace/comptabilite/factures/[id]">) {
  // Le n° de facture n'est connu qu'à la requête : seule la langue est lue ici, le reste sous <Suspense>
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/comptabilite/factures`}>Factures</Retour>
      <Suspense fallback={<p className="mt-6 text-slate-500">Chargement…</p>}>
        <Detail langue={lang} params={params} />
      </Suspense>
    </div>
  );
}

async function Detail({
  langue,
  params,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/comptabilite/factures/[id]">["params"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const id = Number((await params).id);
  const trouvee = Number.isInteger(id) ? await lireFacture(id) : null;
  if (!trouvee) notFound();
  const { facture: f, paiements } = trouvee;
  const medecin = accesMedical(utilisateur);
  const reste = f.totalCts - f.payeCts;
  const jour = (d: string) => d.split("-").reverse().join("/");

  return (
    <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facture {f.numero}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Du {jour(f.date)} · {f.praticienNom}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${couleurStatut[f.statut]}`}>{libelleStatut[f.statut]}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <a
          href={`/api/factures/${f.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          <FileText className="h-4 w-4" aria-hidden />
          Facture en PDF
        </a>
        {f.patientId && medecin && (
          <Link
            href={`/${langue}/espace/patients/${f.patientId}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            <FolderOpen className="h-4 w-4" aria-hidden />
            Dossier du patient
          </Link>
        )}
      </div>

      {f.annulee && (
        <p role="note" className="mt-6 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          Facture annulée : {f.motifAnnulation}
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 p-6 text-sm">
        <p className="text-slate-500">Patient</p>
        <p className="font-medium text-slate-900">{f.patientNom}</p>
        <table className="mt-5 w-full text-left">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1 font-medium">Désignation</th>
              <th className="py-1 text-right font-medium">Qté</th>
              <th className="py-1 text-right font-medium">Prix</th>
              <th className="py-1 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {f.lignes.map((l, i) => (
              <tr key={i}>
                <td className="py-2">{l.libelle}</td>
                <td className="py-2 text-right tabular-nums">{l.quantite}</td>
                <td className="py-2 text-right tabular-nums">{mad(l.prixCts)}</td>
                <td className="py-2 text-right tabular-nums">{mad(Math.round(l.quantite * l.prixCts))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-right">
          {f.remiseCts > 0 && (
            <>
              <div className="flex justify-between">
                <dt className="text-slate-500">Sous-total</dt>
                <dd className="tabular-nums">{mad(totalLignes(f.lignes))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Remise</dt>
                <dd className="tabular-nums">− {mad(f.remiseCts)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <dt>Total</dt>
            <dd className="tabular-nums">{mad(f.totalCts)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Déjà payé</dt>
            <dd className="tabular-nums">{mad(f.payeCts)}</dd>
          </div>
          {!f.annulee && (
            <div className={`flex justify-between font-semibold ${reste > 0 ? "text-red-700" : "text-green-700"}`}>
              <dt>Reste à payer</dt>
              <dd className="tabular-nums">{mad(reste)}</dd>
            </div>
          )}
        </dl>
        {f.note && <p className="mt-4 text-slate-500">{f.note}</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 p-6 text-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Paiements</h2>
        {paiements.length === 0 ? (
          <p className="text-slate-500">Aucun paiement.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {paiements.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  {jour(p.date)} · {libelleMode(p.mode)}
                  {p.reference && <span className="text-slate-500"> · {p.reference}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <strong className="tabular-nums">{mad(p.montantCts)}</strong>
                  {medecin && <BoutonRetirerPaiement langue={langue} factureId={f.id} id={p.id} />}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!f.annulee && reste > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <h3 className="mb-3 font-medium text-slate-900">Encaisser</h3>
            <FormulairePaiement langue={langue} factureId={f.id} reste={reste} aujourdhui={jourLocal(new Date())} debut={f.date} />
          </div>
        )}
      </section>

      {medecin && !f.annulee && (
        <div className="mt-8">
          <FormulaireAnnulation langue={langue} factureId={f.id} />
        </div>
      )}
    </>
  );
}

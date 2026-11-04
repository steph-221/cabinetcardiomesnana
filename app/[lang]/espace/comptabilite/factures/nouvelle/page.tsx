import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Search, UserRound } from "lucide-react";
import { estLangue } from "../../../../../cabinet";
import { jourLocal } from "../../../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../../../agenda/session";
import { consultationDemandee } from "../../../../../dossier/choix-consultation";
import { consultationsPourChoix } from "../../../../../dossier/consultations";
import { baseConfiguree } from "../../../../../dossier/base";
import { listerActes, listerPraticiens } from "../../../../../dossier/compta";
import { libellePatient, lirePatient, rechercherPatients } from "../../../../../dossier/patients";
import { BaseNonConfiguree, Retour } from "../../../patients/commun";
import { FormulaireFacture } from "../../formulaires";

export const metadata: Metadata = {
  title: "Nouvelle facture",
  robots: { index: false, follow: false },
};

export default async function NouvelleFacture({ params, searchParams }: PageProps<"/[lang]/espace/comptabilite/factures/nouvelle">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/comptabilite/factures`}>Factures</Retour>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-slate-900">Nouvelle facture</h1>
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
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
  searchParams: PageProps<"/[lang]/espace/comptabilite/factures/nouvelle">["searchParams"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;

  const params = await searchParams;
  const base = `/${langue}/espace/comptabilite/factures/nouvelle`;
  const idPatient = Number(params.patient);
  const patient = Number.isInteger(idPatient) && idPatient > 0 ? await lirePatient(idPatient) : null;

  // Étape 1 : choisir le patient (ou facturer quelqu'un qui n'a pas de dossier)
  if (!patient && params.libre !== "1") {
    const q = String(params.q ?? "").trim().slice(0, 100);
    const resultats = q ? await rechercherPatients(q, 10) : [];
    return (
      <>
        <form action={base} className="flex gap-3">
          <label className="relative flex-1">
            <span className="sr-only">Rechercher un patient</span>
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="Nom, téléphone ou n° de dossier"
              className="w-full rounded-full border border-slate-300 py-2 ps-9 pe-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </label>
          <button type="submit" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Chercher
          </button>
        </form>
        {q &&
          (resultats.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aucun dossier trouvé.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {resultats.map((r) => (
                <li key={r.id}>
                  <Link href={`${base}?patient=${r.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-slate-50">
                    <span className="font-medium text-slate-900">{libellePatient(r)}</span>
                    <span className="text-slate-500">{r.telephone}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        <p className="mt-6 text-sm">
          <Link href={`${base}?libre=1`} className="inline-flex items-center gap-1 text-red-700 hover:underline">
            <UserRound className="h-4 w-4" aria-hidden />
            Facturer une personne sans dossier
          </Link>
        </p>
      </>
    );
  }

  const [praticiens, actes] = await Promise.all([listerPraticiens(), listerActes()]);
  const actesActifs = actes.filter((a) => !a.archive);
  const actifs = praticiens.filter((p) => p.actif);
  if (actifs.length === 0) return <p className="text-sm text-slate-500">Aucun médecin actif : voir Réglages.</p>;
  // Le médecin connecté est présélectionné s'il est relié à un médecin des réglages
  const moi = actifs.find((p) => p.compte === utilisateur.identifiant.toLowerCase());
  // Consultations du patient à relier à la facture ; la secrétaire voit les dates, pas les motifs
  const consultations = patient
    ? (await consultationsPourChoix(patient.id)).map((c) => ({ ...c, motif: accesMedical(utilisateur) ? c.motif : "" }))
    : [];
  const consultationDefaut = consultationDemandee(params.consultation, consultations);

  return (
    <>
      {patient && (
        <p className="mb-6 rounded-lg bg-slate-50 p-3 text-sm">
          Patient : <strong>{libellePatient(patient)}</strong> ·{" "}
          <Link href={base} className="text-red-700 hover:underline">
            changer
          </Link>
        </p>
      )}
      <FormulaireFacture
        langue={langue}
        patient={patient ? { id: patient.id, nom: libellePatient(patient) } : null}
        praticiens={actifs.map((p) => ({ id: p.id, nom: p.nom }))}
        praticienParDefaut={(moi ?? actifs[0]).id}
        actes={actesActifs}
        aujourdhui={jourLocal(new Date())}
        consultations={consultations}
        consultationDefaut={consultationDefaut}
      />
    </>
  );
}

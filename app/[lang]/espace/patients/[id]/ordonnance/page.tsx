import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../cabinet";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { consultationDemandee } from "../../../../../dossier/choix-consultation";
import { consultationsPourChoix } from "../../../../../dossier/consultations";
import { libellePatient, listerTraitements, lirePatient } from "../../../../../dossier/patients";
import { Retour } from "../../commun";
import { FormulaireOrdonnance } from "../../documents";

export const metadata: Metadata = {
  title: "Nouvelle ordonnance",
  robots: { index: false, follow: false },
};

export default async function NouvelleOrdonnance({ params, searchParams }: PageProps<"/[lang]/espace/patients/[id]/ordonnance">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Formulaire langue={lang} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Formulaire({
  langue,
  params,
  searchParams,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/patients/[id]/ordonnance">["params"];
  searchParams: PageProps<"/[lang]/espace/patients/[id]/ordonnance">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const enCours = (await listerTraitements(id)).filter((t) => !t.fin);
  const consultations = await consultationsPourChoix(id);
  const recherche = await searchParams;
  const consultationDefaut = consultationDemandee(recherche.consultation, consultations);
  const dicteeBrute = Array.isArray(recherche.dictee) ? recherche.dictee[0] : recherche.dictee;
  const dictee = (dicteeBrute ?? "").slice(0, 2000);

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}?onglet=ordonnances`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Nouvelle ordonnance</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Les traitements en cours sont repris : retirez ou complétez les lignes. Pour une radio, une coronarographie,
        une épreuve d&apos;effort…, écrivez ou dictez simplement la demande dans la case « Demande d&apos;examens ».
        « Enregistrer et imprimer » lance l&apos;impression tout de suite, avec l&apos;en-tête du cabinet.
      </p>
      {patient.allergies && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          Allergies : {patient.allergies}
        </p>
      )}
      <FormulaireOrdonnance
        langue={langue}
        patientId={id}
        traitements={enCours.map((t) => ({ medicament: t.medicament, posologie: t.posologie }))}
        consultations={consultations}
        consultationDefaut={consultationDefaut}
        dicteeInitiale={dictee}
        allergies={patient.allergies}
      />
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../cabinet";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { consultationDemandee } from "../../../../../dossier/choix-consultation";
import { consultationsPourChoix } from "../../../../../dossier/consultations";
import { libellePatient, lirePatient } from "../../../../../dossier/patients";
import { Retour } from "../../commun";
import { FormulairePrescriptionBiologie } from "../../prescription-biologie";

export const metadata: Metadata = {
  title: "Prescription d'analyses",
  robots: { index: false, follow: false },
};

export default async function NouvellePrescription({ params, searchParams }: PageProps<"/[lang]/espace/patients/[id]/prescription">) {
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
  params: PageProps<"/[lang]/espace/patients/[id]/prescription">["params"];
  searchParams: PageProps<"/[lang]/espace/patients/[id]/prescription">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const consultations = await consultationsPourChoix(id);
  const recherche = await searchParams;

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Prescription d&apos;analyses biologiques</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Cochez les analyses à demander : l&apos;ordonnance est générée avec la liste, prête à imprimer depuis le dossier.
      </p>
      <FormulairePrescriptionBiologie
        langue={langue}
        patientId={id}
        consultations={consultations}
        consultationDefaut={consultationDemandee(recherche.consultation, consultations)}
      />
    </>
  );
}

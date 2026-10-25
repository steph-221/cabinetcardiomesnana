import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../cabinet";
import { jourLocal } from "../../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { listerConsultations, mesures } from "../../../../../dossier/consultations";
import { libellePatient, lirePatient } from "../../../../../dossier/patients";
import { delais, suivisCourants } from "../../../../../dossier/suivis";
import { Retour } from "../../commun";
import { FormulaireConsultation } from "../../consultation";

export const metadata: Metadata = {
  title: "Nouvelle consultation",
  robots: { index: false, follow: false },
};

export default async function NouvelleConsultation({ params }: PageProps<"/[lang]/espace/patients/[id]/consultation">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Formulaire langue={lang} params={params} />
      </Suspense>
    </div>
  );
}

async function Formulaire({
  langue,
  params,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/patients/[id]/consultation">["params"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  // La taille change peu : reprise de la dernière consultation
  const tailleConnue = (await listerConsultations(id)).find((c) => c.taille)?.taille ?? null;

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-slate-900">Nouvelle consultation</h1>
      <FormulaireConsultation
        langue={langue}
        patientId={id}
        consultation={null}
        tailleConnue={tailleConnue}
        definitions={mesures}
        choixSuivi={{ quoi: suivisCourants, delais }}
        aujourdhui={jourLocal(new Date())}
      />
    </>
  );
}

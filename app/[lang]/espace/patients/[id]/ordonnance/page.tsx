import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../cabinet";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { libellePatient, listerTraitements, lirePatient } from "../../../../../dossier/patients";
import { Retour } from "../../commun";
import { FormulaireOrdonnance } from "../../documents";

export const metadata: Metadata = {
  title: "Nouvelle ordonnance",
  robots: { index: false, follow: false },
};

export default async function NouvelleOrdonnance({ params }: PageProps<"/[lang]/espace/patients/[id]/ordonnance">) {
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
  params: PageProps<"/[lang]/espace/patients/[id]/ordonnance">["params"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const enCours = (await listerTraitements(id)).filter((t) => !t.fin);

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Nouvelle ordonnance</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Les traitements en cours sont repris : retirez ou complétez les lignes, puis enregistrez. L&apos;ordonnance
        s&apos;imprime depuis le dossier, avec l&apos;en-tête du cabinet.
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
      />
    </>
  );
}

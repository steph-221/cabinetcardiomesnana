import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../cabinet";
import { jourLocal } from "../../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { consultationDemandee } from "../../../../../dossier/choix-consultation";
import { consultationsPourChoix } from "../../../../../dossier/consultations";
import { claudeConfigure } from "../../../../../dossier/dictee";
import { libellePatient, lirePatient } from "../../../../../dossier/patients";
import { typesRedaction } from "../../../../../dossier/redaction";
import { Retour } from "../../commun";
import { RedactionCompteRendu } from "../../redaction";

export const metadata: Metadata = {
  title: "Rédiger un compte rendu",
  robots: { index: false, follow: false },
};

export default async function Redaction({ params, searchParams }: PageProps<"/[lang]/espace/patients/[id]/redaction">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Contenu({
  langue,
  params,
  searchParams,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/patients/[id]/redaction">["params"];
  searchParams: PageProps<"/[lang]/espace/patients/[id]/redaction">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const consultations = await consultationsPourChoix(id);
  const consultationDefaut = consultationDemandee((await searchParams).consultation, consultations);

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Rédiger un compte rendu à partir d&apos;une dictée</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Claude met la dictée en forme dans le modèle du cabinet, calcule, signale les incohérences et propose le « AU TOTAL ».
      </p>
      <RedactionCompteRendu
        langue={langue}
        patientId={id}
        types={typesRedaction}
        claude={claudeConfigure()}
        aujourdhui={jourLocal(new Date())}
        consultations={consultations}
        consultationDefaut={consultationDefaut}
      />
    </>
  );
}

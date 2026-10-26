import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { cabinet, estLangue } from "../../../../../cabinet";
import { jourLocal } from "../../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { listerConsultations } from "../../../../../dossier/consultations";
import { libellePatient, lirePatient } from "../../../../../dossier/patients";
import { Retour } from "../../commun";
import { FormulaireETT } from "../../documents";

export const metadata: Metadata = {
  title: "Compte rendu d'ETT",
  robots: { index: false, follow: false },
};

export default async function CompteRenduETT({ params }: PageProps<"/[lang]/espace/patients/[id]/ett">) {
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
  params: PageProps<"/[lang]/espace/patients/[id]/ett">["params"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  // Poids et taille de la dernière consultation, pour la surface corporelle
  const consultations = await listerConsultations(id);
  const poids = consultations.find((c) => c.poids !== null)?.poids ?? null;
  const taille = consultations.find((c) => c.taille !== null)?.taille ?? null;

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Compte rendu d&apos;échocardiographie-Doppler</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Seuls les champs remplis apparaissent dans le compte rendu. Les calculs et les propositions se mettent à jour
        pendant la saisie.
      </p>
      <FormulaireETT
        langue={langue}
        patientId={id}
        sexe={patient.sexe}
        poids={poids}
        taille={taille}
        operateur={utilisateur.admin ? cabinet.medecin : utilisateur.identifiant}
        aujourdhui={jourLocal(new Date())}
      />
    </>
  );
}

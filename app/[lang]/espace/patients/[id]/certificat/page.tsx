import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { cabinet, estLangue } from "../../../../../cabinet";
import { jourLocal } from "../../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { consultationDemandee } from "../../../../../dossier/choix-consultation";
import { consultationsPourChoix } from "../../../../../dossier/consultations";
import { libellePatient, lirePatient } from "../../../../../dossier/patients";
import { listerModelesPerso } from "../../../../../dossier/modeles-certificats-perso";
import { Retour } from "../../commun";
import { FormulaireCertificat } from "../../certificats";

export const metadata: Metadata = {
  title: "Nouveau certificat",
  robots: { index: false, follow: false },
};

export default async function NouveauCertificat({ params, searchParams }: PageProps<"/[lang]/espace/patients/[id]/certificat">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
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
  params: PageProps<"/[lang]/espace/patients/[id]/certificat">["params"];
  searchParams: PageProps<"/[lang]/espace/patients/[id]/certificat">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const consultations = await consultationsPourChoix(id);
  const modelesPerso = await listerModelesPerso();
  const recherche = await searchParams;

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}?onglet=certificats`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Nouveau certificat</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Choisissez un modèle et remplissez les champs : le texte se compose sous vos yeux et reste modifiable.
        Vous pouvez aussi créer vos propres modèles (« Nouveau modèle »).
        L&apos;en-tête et la formule finale sont ajoutés automatiquement.
      </p>
      <FormulaireCertificat
        langue={langue}
        patientId={id}
        contexte={{
          patient: { nom: patient.nom, prenom: patient.prenom, sexe: patient.sexe, naissance: patient.naissance },
          date: jourLocal(new Date()),
          medecin: cabinet.medecin,
          ville: cabinet.adresse.ville,
        }}
        consultations={consultations}
        modelesPerso={modelesPerso}
        consultationDefaut={consultationDemandee(recherche.consultation, consultations)}
      />
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { estLangue } from "../../../../cabinet";
import { jourLocal } from "../../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { couvertures, facteursRisque } from "../../../../dossier/patients";
import { BaseNonConfiguree, Retour } from "../commun";
import { FormulairePatient } from "../formulaires";

export const metadata: Metadata = {
  title: "Nouveau patient",
  robots: { index: false, follow: false },
};

export default async function NouveauPatient({ params, searchParams }: PageProps<"/[lang]/espace/patients/nouveau">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/patients`}>Patients</Retour>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-slate-900">Nouveau patient</h1>
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Formulaire langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Formulaire({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/patients/nouveau">["searchParams"];
}) {
  await connection();
  // Ce que le patient a déjà indiqué en prenant rendez-vous (modifiable avant d'enregistrer)
  const q = await searchParams;
  const lire = (cle: string) => (typeof q[cle] === "string" ? (q[cle] as string).slice(0, 300) : "");
  const prefill = {
    nom: lire("nom"),
    prenom: lire("prenom"),
    telephone: lire("telephone"),
    naissance: lire("naissance"),
    email: lire("email"),
    rdv: lire("rdv"),
  };
  const utilisateur = await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  return (
    <FormulairePatient
      prefill={prefill}
      langue={langue}
      patient={null}
      medical={accesMedical(utilisateur)}
      facteurs={facteursRisque}
      couvertures={couvertures}
      aujourdhui={jourLocal(new Date())}
    />
  );
}

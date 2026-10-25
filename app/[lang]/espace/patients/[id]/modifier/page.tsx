import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../cabinet";
import { jourLocal } from "../../../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../../../agenda/session";
import { couvertures, facteursRisque, libellePatient, lirePatient } from "../../../../../dossier/patients";
import { Retour } from "../../commun";
import { FormulairePatient } from "../../formulaires";

export const metadata: Metadata = {
  title: "Modifier le dossier",
  robots: { index: false, follow: false },
};

export default async function ModifierPatient({ params }: PageProps<"/[lang]/espace/patients/[id]/modifier">) {
  // Le n° de dossier n'est connu qu'à la requête : seule la langue est lue ici, le reste sous <Suspense>
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
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
  params: PageProps<"/[lang]/espace/patients/[id]/modifier">["params"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const medical = accesMedical(utilisateur);

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-slate-900">Modifier le dossier</h1>
      <FormulairePatient
        langue={langue}
        // La secrétaire ne reçoit jamais le contenu médical, même masqué
        patient={medical ? patient : { ...patient, facteursRisque: [], antecedents: "", allergies: "", notes: "" }}
        medical={medical}
        facteurs={facteursRisque}
        couvertures={couvertures}
        aujourdhui={jourLocal(new Date())}
      />
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { cabinet, estLangue } from "../../../../../../cabinet";
import { jourLocal } from "../../../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../../../agenda/session";
import { trouverModele } from "../../../../../../dossier/comptes-rendus";
import { age, libellePatient, lirePatient } from "../../../../../../dossier/patients";
import { lireReferences } from "../../../../../../dossier/verification-seuils";
import { Retour } from "../../../commun";
import { FormulaireExamen } from "../../../formulaire-examen";

export const metadata: Metadata = {
  title: "Compte rendu d'examen",
  robots: { index: false, follow: false },
};

export default async function CompteRenduExamen({
  params,
}: PageProps<"/[lang]/espace/patients/[id]/examen/[modele]">) {
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
  params: PageProps<"/[lang]/espace/patients/[id]/examen/[modele]">["params"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const { id: brut, modele: cle } = await params;
  const id = Number(brut);
  const modele = trouverModele(cle);
  const patient = Number.isInteger(id) && id > 0 && modele ? await lirePatient(id) : null;
  if (!patient || !modele) notFound();
  const aujourdhui = jourLocal(new Date());
  const references = await lireReferences().catch(() => ({}));

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{modele.bouton} : compte rendu</h1>
      <p className="mt-1 mb-2 text-sm text-slate-500">
        {modele.resume} Seuls les champs remplis apparaissent dans le compte rendu. Les calculs et les propositions se
        mettent à jour pendant la saisie.
      </p>
      <p className="mb-6 text-xs text-slate-400">{modele.verification}</p>
      <FormulaireExamen
        langue={langue}
        patientId={id}
        cle={modele.cle}
        sexe={patient.sexe}
        age={age(patient.naissance, aujourdhui)}
        operateur={utilisateur.admin ? cabinet.medecin : utilisateur.identifiant}
        aujourdhui={aujourdhui}
        references={references}
      />
    </>
  );
}

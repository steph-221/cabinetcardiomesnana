import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../../cabinet";
import { jourLocal } from "../../../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../../../agenda/session";
import { lireConsultation, listerConsultations, mesures } from "../../../../../../dossier/consultations";
import { age, libellePatient, lirePatient } from "../../../../../../dossier/patients";
import { donneesPourCalculs, fevgDesExamens } from "../../../../../../dossier/donnees-calculs";
import { listerExamens } from "../../../../../../dossier/examens";
import { listerFactures } from "../../../../../../dossier/compta";
import { listerOrdonnances } from "../../../../../../dossier/ordonnances";
import { resultatsDesExamens } from "../../../../../../dossier/resultats";
import { listerScoresPatient } from "../../../../../../dossier/scores-patients";
import { delais, suivisCourants } from "../../../../../../dossier/suivis";
import { claudeConfigure } from "../../../../../../dossier/dictee";
import { lireLexique } from "../../../../../../dossier/lexique";
import { Retour } from "../../../commun";
import { BoutonSupprimerConsultation, FormulaireConsultation } from "../../../consultation";
import { ElementsConsultation } from "../../../elements-consultation";

export const metadata: Metadata = {
  title: "Consultation",
  robots: { index: false, follow: false },
};

export default async function ModifierConsultation({
  params,
}: PageProps<"/[lang]/espace/patients/[id]/consultation/[cid]">) {
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
  params: PageProps<"/[lang]/espace/patients/[id]/consultation/[cid]">["params"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const { id: brut, cid } = await params;
  const id = Number(brut);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  const consultation = patient && Number.isInteger(Number(cid)) ? await lireConsultation(id, Number(cid)) : null;
  if (!patient || !consultation) notFound();

  // Ce qui se rapporte à cette consultation (et ce qui peut encore s'y rattacher)
  const [consultations, examens, ordonnances, factures, scores] = await Promise.all([
    listerConsultations(id),
    listerExamens(id),
    listerOrdonnances(id),
    // Un souci de lecture des factures ne doit pas empêcher d'ouvrir la consultation
    listerFactures({ patientId: id, limite: 100 }).catch((erreur) => {
      console.error(erreur);
      return [];
    }),
    listerScoresPatient(id),
  ]);
  const resultats = await resultatsDesExamens(examens.map((e) => e.id));
  const donnees = donneesPourCalculs({
    patient,
    age: age(patient.naissance, consultation.date),
    consultations,
    fevgEchos: fevgDesExamens(examens),
    consultation,
  });

  return (
    <>
      <Retour href={`/${langue}/espace/patients/${id}#consultations`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 mb-1 text-2xl font-bold text-slate-900">
        Consultation du {consultation.date.split("-").reverse().join("/")}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Saisie par {consultation.creePar}
        {consultation.modifiePar !== consultation.creePar && `, modifiée par ${consultation.modifiePar}`}
      </p>
      <ElementsConsultation
        langue={langue}
        patientId={id}
        consultation={consultation}
        donnees={donnees}
        scores={scores}
        examens={examens}
        ordonnances={ordonnances}
        factures={factures}
        resultats={resultats}
      />
      <FormulaireConsultation
        langue={langue}
        patientId={id}
        consultation={consultation}
        tailleConnue={null}
        definitions={mesures}
        choixSuivi={{ quoi: suivisCourants, delais }}
        dictee={{
          lexique: (await lireLexique()).map(({ entendu, correct }) => ({ entendu, correct })),
          claude: claudeConfigure(),
        }}
        aujourdhui={jourLocal(new Date())}
      />
      <div className="mt-12 border-t border-slate-200 pt-6">
        <BoutonSupprimerConsultation langue={langue} patientId={id} id={consultation.id} />
      </div>
    </>
  );
}

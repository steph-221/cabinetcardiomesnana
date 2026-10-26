import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../../cabinet";
import { jourLocal } from "../../../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../../../agenda/session";
import { lireConsultation, mesures } from "../../../../../../dossier/consultations";
import { libellePatient, lirePatient } from "../../../../../../dossier/patients";
import { delais, suivisCourants } from "../../../../../../dossier/suivis";
import { claudeConfigure } from "../../../../../../dossier/dictee";
import { lireLexique } from "../../../../../../dossier/lexique";
import { Retour } from "../../../commun";
import { BoutonSupprimerConsultation, FormulaireConsultation } from "../../../consultation";

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

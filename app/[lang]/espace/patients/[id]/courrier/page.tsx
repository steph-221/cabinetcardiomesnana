import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Printer } from "lucide-react";
import { estLangue } from "../../../../../cabinet";
import { exigerUtilisateur } from "../../../../../agenda/session";
import { consultationsPourChoix, lireConsultation } from "../../../../../dossier/consultations";
import { objetCourrier, texteCourrier } from "../../../../../dossier/courrier";
import { age, libellePatient, lirePatient, listerTraitements } from "../../../../../dossier/patients";
import { Retour } from "../../../patients/commun";

export const metadata: Metadata = {
  title: "Courrier au confrère",
  robots: { index: false, follow: false },
};

export default function Courrier({ params, searchParams }: PageProps<"/[lang]/espace/patients/[id]/courrier">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Contenu params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

async function Contenu({
  params,
  searchParams,
}: {
  params: PageProps<"/[lang]/espace/patients/[id]/courrier">["params"];
  searchParams: PageProps<"/[lang]/espace/patients/[id]/courrier">["searchParams"];
}) {
  await connection();
  const { lang, id: brut } = await params;
  if (!estLangue(lang)) notFound();
  await exigerUtilisateur(lang, "medical");
  const id = Number(brut);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const demande = (await searchParams).consultation;
  let cid = Number(Array.isArray(demande) ? demande[0] : demande);
  // Sans consultation précisée : la plus récente du dossier
  if (!Number.isInteger(cid) || cid <= 0) cid = (await consultationsPourChoix(id))[0]?.id ?? 0;
  const consultation = cid ? await lireConsultation(id, cid) : null;
  if (!consultation) {
    return (
      <>
        <Retour href={`/${lang}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
        <p className="mt-6 text-slate-600">Ce dossier n&apos;a pas encore de consultation : le courrier se rédige à partir d&apos;une consultation.</p>
      </>
    );
  }
  const traitements = (await listerTraitements(id))
    .filter((t) => (!t.debut || t.debut <= consultation.date) && (!t.fin || t.fin > consultation.date))
    .map((t) => [t.medicament, t.posologie].filter(Boolean).join(" "));
  const n = (v: number | null, unite: string, nom: string) => (v === null ? "" : `${nom} ${String(v).replace(".", ",")} ${unite}`);
  const constantes = [
    consultation.taSys !== null && consultation.taDia !== null ? `TA ${consultation.taSys}/${consultation.taDia} mmHg` : "",
    n(consultation.fc, "bpm", "FC"),
    n(consultation.spo2, "%", "SpO₂"),
    n(consultation.poids, "kg", "poids"),
  ]
    .filter(Boolean)
    .join(", ");
  const donnees = {
    confrere: patient.medecinTraitant,
    patient: { nom: patient.nom, prenom: patient.prenom, sexe: patient.sexe, age: age(patient.naissance, consultation.date) },
    date: consultation.date,
    motif: consultation.motif,
    antecedents: patient.antecedents,
    traitements,
    examen: consultation.examen,
    ecg: consultation.ecg,
    autres: consultation.autres,
    conclusion: consultation.conclusion,
    conduite: consultation.conduite,
    constantes,
  };

  return (
    <>
      <Retour href={`/${lang}/espace/patients/${id}`}>{libellePatient(patient)}</Retour>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Courrier au confrère</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Rédigé d&apos;après la consultation du {consultation.date.split("-").reverse().join("/")} : rien n&apos;est ajouté. Relisez,
        corrigez, puis imprimez.
      </p>
      <form action="/api/courriers/pdf" method="post" target="_blank" className="space-y-4">
        <input type="hidden" name="patient" value={id} />
        <input type="hidden" name="date" value={consultation.date} />
        <label className="block text-sm font-medium text-slate-700">
          Destinataire
          <input name="destinataire" defaultValue={patient.medecinTraitant} maxLength={150} placeholder="Dr … (médecin traitant)" className={champ} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Objet
          <input name="objet" defaultValue={objetCourrier(patient, consultation.date)} maxLength={250} className={champ} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Courrier (modifiable)
          <textarea name="texte" defaultValue={texteCourrier(donnees)} rows={22} maxLength={8000} className={champ} />
        </label>
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
          <Printer className="h-4 w-4" aria-hidden />
          Imprimer le PDF
        </button>
      </form>
    </>
  );
}

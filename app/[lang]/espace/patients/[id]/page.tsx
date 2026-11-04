import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import {
  Calculator,
  ClipboardPlus,
  History,
  MessagesSquare,
  Pencil,
  Phone,
  Receipt,
  ScrollText,
  TriangleAlert,
} from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { jourLocal } from "../../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../../agenda/session";
import { alertes } from "../../../../dossier/calculs";
import { listerConsultations } from "../../../../dossier/consultations";
import { compteDrive } from "../../../../dossier/drive";
import { listerExamens } from "../../../../dossier/examens";
import { journaliser } from "../../../../dossier/journal";
import { listerFactures } from "../../../../dossier/compta";
import { listerOrdonnances } from "../../../../dossier/ordonnances";
import { ongletValide } from "../../../../dossier/onglets-patient";
import { consultationDemandee } from "../../../../dossier/choix-consultation";
import { catalogueScores, listerScoresPatient } from "../../../../dossier/scores-patients";
import { donneesPourCalculs, fevgDesExamens } from "../../../../dossier/donnees-calculs";
import { listerSuivisPatient } from "../../../../dossier/suivis";
import { age, libellePatient, listerTraitements, lirePatient } from "../../../../dossier/patients";
import { Retour } from "../commun";
import { FormulaireScore } from "../scores-formulaire";
import { ScoresDossier, ValeursCalculees } from "../scores-dossier";
import { BoutonSupprimerPatient } from "../formulaires";
import { Apercu } from "./apercu";
import { NavOnglets } from "./onglets";
import { Coordonnees, ContenuMedical, Examens, FacturesPatient, Ordonnances } from "./sections";
import { Alertes, CourbesEvolution, ListeConsultations } from "./suivi";

export const metadata: Metadata = {
  title: "Dossier patient",
  robots: { index: false, follow: false },
};

export default async function DossierPatient({ params, searchParams }: PageProps<"/[lang]/espace/patients/[id]">) {
  // Le n° de dossier n'est connu qu'à la requête : seule la langue est lue ici, le reste sous <Suspense>
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/patients`}>Patients</Retour>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement du dossier…</p>}>
        <Dossier langue={lang} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const date = (jour: string) => jour.split("-").reverse().join("/");

async function Dossier({
  langue,
  params,
  searchParams,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/patients/[id]">["params"];
  searchParams: PageProps<"/[lang]/espace/patients/[id]">["searchParams"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const medical = accesMedical(utilisateur);
  // Section demandée dans l'adresse (?onglet=…) ; l'aperçu par défaut
  const demande = await searchParams;
  const onglet = ongletValide(demande.onglet, medical);
  const [traitements, consultations, examens, drive, suivis, ordonnances, factures] = await Promise.all([
    medical ? listerTraitements(id) : [],
    medical ? listerConsultations(id) : [],
    listerExamens(id),
    onglet === "examens" ? compteDrive().catch(() => null) : null,
    listerSuivisPatient(id),
    medical ? listerOrdonnances(id) : [],
    // Un souci de lecture des factures ne doit pas empêcher d'ouvrir le dossier
    listerFactures({ patientId: id, limite: 100 }).catch((erreur) => {
      console.error(erreur);
      return null;
    }),
  ]);
  // Calculs rattachés au dossier (médecins seulement)
  const scores = medical ? await listerScoresPatient(id) : [];
  // FEVG mesurées dans les comptes rendus d'ETT : elles complètent la courbe et les alertes
  const fevgEchos = fevgDesExamens(examens);

  // Chaque ouverture de dossier est tracée, après l'envoi de la page pour ne pas la ralentir
  after(() => journaliser(utilisateur.identifiant, "consultation du dossier", id).catch(console.error));

  const ans = age(patient.naissance, jourLocal(new Date()));
  // Données reprises par défaut dans les calculs (le médecin les vérifie et peut les modifier)
  const donneesCalcul = donneesPourCalculs({ patient, age: ans, consultations, fevgEchos });
  const signaux = medical
    ? alertes({
        releves: [
          ...consultations,
          ...fevgEchos.map((f) => ({ date: f.date, taSys: null, taDia: null, fc: null, mesures: { fevg: f.valeur } })),
        ].sort((a, b) => b.date.localeCompare(a.date)),
        traitementsEnCours: traitements.filter((t) => !t.fin).map((t) => t.medicament),
        inrMin: patient.inrMin,
        inrMax: patient.inrMax,
        age: ans,
        sexe: patient.sexe,
      })
    : [];
  const liens = { scores, examens, ordonnances, factures: factures ?? [] };
  const aPayer = (factures ?? []).some((f) => !f.annulee && f.totalCts > f.payeCts);
  const base = `/${langue}/espace/patients/${id}`;
  const bouton =
    "inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50";

  return (
    <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {libellePatient(patient)}
            <span className="ms-3 text-base font-normal text-slate-400">n° {patient.id}</span>
          </h1>
          <p className="mt-1 text-slate-600">
            {[
              patient.sexe === "F" ? "Femme" : patient.sexe === "M" ? "Homme" : "",
              ans !== null && patient.naissance ? `${ans} ans (né·e le ${date(patient.naissance)})` : "",
              patient.couverture,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {patient.telephone && (
            <p className="mt-1 text-sm">
              <a
                href={`tel:${patient.telephone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-red-700"
              >
                <Phone className="h-3 w-3" aria-hidden />
                {patient.telephone}
              </a>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {medical && (
            <Link
              href={`${base}/consultation`}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <ClipboardPlus className="h-4 w-4" aria-hidden />
              Nouvelle consultation
            </Link>
          )}
          {medical && (
            <Link href={`${base}/ordonnance`} className={bouton}>
              <ScrollText className="h-4 w-4" aria-hidden />
              Ordonnance
            </Link>
          )}
          <Link href={`/${langue}/espace/comptabilite/factures/nouvelle?patient=${id}`} className={bouton}>
            <Receipt className="h-4 w-4" aria-hidden />
            Facturer
          </Link>
          {medical && (
            <Link href={`/${langue}/espace/assistant?patient=${id}`} className={bouton}>
              <MessagesSquare className="h-4 w-4" aria-hidden />
              Assistant
            </Link>
          )}
          <Link href={`${base}/modifier`} className={bouton}>
            <Pencil className="h-4 w-4" aria-hidden />
            Modifier
          </Link>
          {utilisateur.admin && (
            <Link href={`/${langue}/espace/journal?patient=${id}`} className={bouton}>
              <History className="h-4 w-4" aria-hidden />
              Journal
            </Link>
          )}
        </div>
      </div>

      {medical && patient.allergies && (
        <p
          role="note"
          className="mt-6 flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800"
        >
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
          Allergies : {patient.allergies}
        </p>
      )}
      <Alertes alertes={signaux} />

      <NavOnglets
        base={base}
        actif={onglet}
        medical={medical}
        nombres={{ consultations: consultations.length, examens: examens.length }}
        aPayer={aPayer}
      />

      {onglet === "apercu" && (
        <Apercu
          langue={langue}
          patient={patient}
          medical={medical}
          donnees={donneesCalcul}
          consultations={consultations}
          traitements={traitements}
          suivis={suivis}
          factures={factures}
          liens={liens}
        />
      )}

      {onglet === "consultations" && (
        <div className="mt-6">
          <ListeConsultations langue={langue} patient={patient} consultations={consultations} liens={liens} />
        </div>
      )}

      {onglet === "evolution" && (
        <div className="mt-6 space-y-6">
          <CourbesEvolution patient={patient} consultations={consultations} fevgEchos={fevgEchos} />
          <section id="calculs" className="scroll-mt-36 rounded-2xl border border-slate-200 p-6 text-sm">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Calculator className="h-5 w-5 text-red-600" aria-hidden />
              Calculs
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Choisissez le calcul, enregistrez-le à la date voulue. Refaites-le au fil du suivi pour voir
              l&apos;évolution. Il se rattache à la consultation du même jour.
            </p>
            <ValeursCalculees donnees={donneesCalcul} />
            <FormulaireScore
              langue={langue}
              patientId={id}
              catalogue={catalogueScores}
              dateInitiale={jourLocal(new Date())}
              donnees={donneesCalcul}
            />
            <div className="mt-6">
              <ScoresDossier langue={langue} patientId={id} scores={scores} />
            </div>
          </section>
        </div>
      )}

      {onglet === "examens" && (
        <div className="mt-6">
          <Examens
            langue={langue}
            patientId={id}
            examens={examens}
            medical={medical}
            drive={Boolean(drive)}
            consultations={consultations}
            consultationDefaut={consultationDemandee(demande.consultation, consultations)}
          />
        </div>
      )}

      {onglet === "documents" && (
        <div className="mt-6 space-y-6">
          {medical && (
            <Ordonnances langue={langue} patientId={id} ordonnances={ordonnances} consultations={consultations} />
          )}
          {factures && (
            <FacturesPatient langue={langue} patientId={id} factures={factures} consultations={consultations} />
          )}
        </div>
      )}

      {onglet === "fiche" && (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Coordonnees patient={patient} />
            {medical ? (
              <ContenuMedical langue={langue} patient={patient} traitements={traitements} />
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 lg:col-span-2">
                Le contenu médical du dossier est réservé aux médecins.
              </p>
            )}
          </div>
          {utilisateur.admin && (
            <div className="mt-12 border-t border-slate-200 pt-6">
              <BoutonSupprimerPatient langue={langue} id={id} nom={libellePatient(patient)} />
            </div>
          )}
        </>
      )}
    </>
  );
}

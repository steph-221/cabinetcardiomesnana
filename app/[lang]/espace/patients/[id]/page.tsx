import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { CalendarClock, ExternalLink, FileText, History, MessageCircle, Pencil, Phone, Pill, TriangleAlert } from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { jourLocal } from "../../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../../agenda/session";
import { alertes } from "../../../../dossier/calculs";
import { listerConsultations } from "../../../../dossier/consultations";
import { compteDrive } from "../../../../dossier/drive";
import { listerExamens, TAILLE_MAX, typesExamen, type Examen } from "../../../../dossier/examens";
import { journaliser } from "../../../../dossier/journal";
import { delais, listerSuivisPatient, suivisCourants, type SuiviPatient } from "../../../../dossier/suivis";
import {
  age,
  libellePatient,
  lienWhatsApp,
  listerTraitements,
  lirePatient,
  type Patient,
  type Traitement,
} from "../../../../dossier/patients";
import { Retour } from "../commun";
import { BoutonSupprimerExamen, ConclusionExamen, EnvoiExamens } from "../examens";
import { BoutonSupprimerPatient, BoutonsTraitement, FormulaireTraitement } from "../formulaires";
import { LigneSuivi } from "../liste-suivis";
import { FormulaireSuivi } from "../suivis";
import { Alertes, SuiviMedical } from "./suivi";

export const metadata: Metadata = {
  title: "Dossier patient",
  robots: { index: false, follow: false },
};

export default async function DossierPatient({ params }: PageProps<"/[lang]/espace/patients/[id]">) {
  // Le n° de dossier n'est connu qu'à la requête : seule la langue est lue ici, le reste sous <Suspense>
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/patients`}>Patients</Retour>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement du dossier…</p>}>
        <Dossier langue={lang} params={params} />
      </Suspense>
    </div>
  );
}

const date = (jour: string) => jour.split("-").reverse().join("/");

async function Dossier({
  langue,
  params,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/patients/[id]">["params"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  const id = Number((await params).id);
  const patient = Number.isInteger(id) && id > 0 ? await lirePatient(id) : null;
  if (!patient) notFound();
  const medical = accesMedical(utilisateur);
  const [traitements, consultations, examens, drive, suivis] = await Promise.all([
    medical ? listerTraitements(id) : [],
    medical ? listerConsultations(id) : [],
    listerExamens(id),
    compteDrive().catch(() => null),
    listerSuivisPatient(id),
  ]);

  // Chaque ouverture de dossier est tracée, après l'envoi de la page pour ne pas la ralentir
  after(() => journaliser(utilisateur.identifiant, "consultation du dossier", id).catch(console.error));

  const ans = age(patient.naissance, jourLocal(new Date()));
  const signaux = medical
    ? alertes({
        releves: consultations,
        traitementsEnCours: traitements.filter((t) => !t.fin).map((t) => t.medicament),
        inrMin: patient.inrMin,
        inrMax: patient.inrMax,
        age: ans,
        sexe: patient.sexe,
      })
    : [];
  const whatsapp = patient.telephone ? lienWhatsApp(patient.telephone) : null;
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
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${langue}/espace/patients/${id}/modifier`} className={bouton}>
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
        <p role="note" className="mt-6 flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
          Allergies : {patient.allergies}
        </p>
      )}
      <Alertes alertes={signaux} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 p-6 text-sm lg:col-span-1">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Coordonnées</h2>
          <dl className="space-y-2">
            {patient.telephone && (
              <div>
                <dt className="text-slate-500">Téléphone</dt>
                <dd className="flex flex-wrap items-center gap-3">
                  <a
                    href={`tel:${patient.telephone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-1 text-slate-900 hover:text-red-700"
                  >
                    <Phone className="h-3 w-3" aria-hidden />
                    {patient.telephone}
                  </a>
                  {whatsapp && (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-green-700 hover:underline"
                    >
                      <MessageCircle className="h-3 w-3" aria-hidden />
                      WhatsApp
                    </a>
                  )}
                </dd>
              </div>
            )}
            <Ligne titre="E-mail" valeur={patient.email} />
            <Ligne titre="CIN" valeur={patient.cin} />
            <Ligne titre="Adresse" valeur={patient.adresse} />
            <Ligne titre="Médecin traitant" valeur={patient.medecinTraitant} />
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            Créé par {patient.creePar}, modifié par {patient.modifiePar} le{" "}
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(patient.modifieLe)}
          </p>
        </section>

        {medical ? (
          <ContenuMedical langue={langue} patient={patient} traitements={traitements} />
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 lg:col-span-2">
            Le contenu médical du dossier est réservé aux médecins.
          </p>
        )}
      </div>

      <Suivis langue={langue} patient={patient} suivis={suivis} />

      {medical && <SuiviMedical langue={langue} patient={patient} age={ans} consultations={consultations} />}

      <Examens langue={langue} patientId={id} examens={examens} medical={medical} drive={Boolean(drive)} />

      {utilisateur.admin && (
        <div className="mt-12 border-t border-slate-200 pt-6">
          <BoutonSupprimerPatient langue={langue} id={id} nom={libellePatient(patient)} />
        </div>
      )}
    </>
  );
}

function Ligne({ titre, valeur }: { titre: string; valeur: string }) {
  if (!valeur) return null;
  return (
    <div>
      <dt className="text-slate-500">{titre}</dt>
      <dd className="whitespace-pre-line text-slate-900">{valeur}</dd>
    </div>
  );
}

function ContenuMedical({
  langue,
  patient,
  traitements,
}: {
  langue: string;
  patient: Patient;
  traitements: Traitement[];
}) {
  const enCours = traitements.filter((t) => !t.fin);
  const arretes = traitements.filter((t) => t.fin);

  return (
    <div className="space-y-6 lg:col-span-2">
      <section className="rounded-2xl border border-slate-200 p-6 text-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Facteurs de risque et antécédents</h2>
        {patient.facteursRisque.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {patient.facteursRisque.map((f) => (
              <li key={f} className="rounded-full bg-red-50 px-3 py-1 text-red-800">
                {f}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">Aucun facteur de risque renseigné.</p>
        )}
        {patient.antecedents && <p className="mt-4 whitespace-pre-line text-slate-900">{patient.antecedents}</p>}
        {patient.notes && (
          <>
            <h3 className="mt-4 font-medium text-slate-700">Notes</h3>
            <p className="mt-1 whitespace-pre-line text-slate-900">{patient.notes}</p>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-6 text-sm">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Pill className="h-5 w-5 text-red-600" aria-hidden />
          Traitements en cours
        </h2>
        {enCours.length === 0 ? (
          <p className="text-slate-500">Aucun traitement en cours.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {enCours.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium text-slate-900">{t.medicament}</span>
                  {t.posologie && <span className="ms-2 text-slate-600">{t.posologie}</span>}
                  {t.debut && <span className="ms-2 text-slate-400">depuis le {date(t.debut)}</span>}
                </span>
                <BoutonsTraitement langue={langue} patientId={patient.id} id={t.id} enCours medicament={t.medicament} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <FormulaireTraitement langue={langue} patientId={patient.id} />
        </div>
        {arretes.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-slate-600">Traitements arrêtés ({arretes.length})</summary>
            <ul className="mt-2 divide-y divide-slate-100">
              {arretes.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-slate-500">
                  <span>
                    <span className="line-through">{t.medicament}</span>
                    {t.posologie && <span className="ms-2">{t.posologie}</span>}
                    <span className="ms-2">
                      {t.debut ? `du ${date(t.debut)} ` : ""}
                      {t.fin && `arrêté le ${date(t.fin)}`}
                    </span>
                  </span>
                  <BoutonsTraitement
                    langue={langue}
                    patientId={patient.id}
                    id={t.id}
                    enCours={false}
                    medicament={t.medicament}
                  />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function Examens({
  langue,
  patientId,
  examens,
  medical,
  drive,
}: {
  langue: string;
  patientId: number;
  examens: Examen[];
  medical: boolean;
  drive: boolean;
}) {
  const taille = (octets: number) =>
    octets > 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 p-6 text-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <FileText className="h-5 w-5 text-red-600" aria-hidden />
        Examens
      </h2>
      {drive ? (
        <EnvoiExamens
          patientId={patientId}
          types={typesExamen}
          medical={medical}
          tailleMax={TAILLE_MAX}
          aujourdhui={jourLocal(new Date())}
        />
      ) : (
        <p className="rounded-lg bg-amber-50 p-4 text-amber-900">
          Google Drive n&apos;est pas encore connecté : l&apos;administrateur doit le connecter depuis l&apos;espace
          cabinet (bouton « Google Drive »).
        </p>
      )}

      {examens.length === 0 ? (
        <p className="mt-4 text-slate-500">Aucun examen pour le moment.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {examens.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p>
                  <span className="font-mono text-slate-600">{date(e.date)}</span>
                  <span className="ms-3 font-medium text-slate-900">{e.type}</span>
                  {e.fichierNom && (
                    <span className="ms-3 text-slate-400">
                      {e.fichierNom} · {taille(e.fichierTaille)}
                    </span>
                  )}
                </p>
                {medical && e.conclusion && <p className="mt-1 whitespace-pre-line text-slate-700">{e.conclusion}</p>}
                {medical && (
                  <ConclusionExamen langue={langue} patientId={patientId} id={e.id} conclusion={e.conclusion} />
                )}
              </div>
              {medical && (
                <div className="flex items-center gap-1">
                  {e.fichierDrive && (
                    <a
                      href={`/api/fichiers/${e.id}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      Ouvrir
                    </a>
                  )}
                  <BoutonSupprimerExamen
                    langue={langue}
                    patientId={patientId}
                    id={e.id}
                    libelle={`${e.type} du ${date(e.date)}`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Suivis({ langue, patient, suivis }: { langue: string; patient: Patient; suivis: SuiviPatient[] }) {
  const aujourdhui = jourLocal(new Date());
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 p-6 text-sm">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <CalendarClock className="h-5 w-5 text-red-600" aria-hidden />
        Suivi à prévoir
      </h2>
      {suivis.length === 0 ? (
        <p className="text-slate-500">Rien de prévu.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {suivis.map((s) => (
            <LigneSuivi
              key={s.id}
              langue={langue}
              // Coordonnées du patient pour le message de relance
              suivi={{ ...s, nom: patient.nom, prenom: patient.prenom, sexe: patient.sexe, telephone: patient.telephone }}
              aujourdhui={aujourdhui}
              avecPatient={false}
            />
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <FormulaireSuivi langue={langue} patientId={patient.id} choix={{ quoi: suivisCourants, delais }} />
      </div>
    </section>
  );
}

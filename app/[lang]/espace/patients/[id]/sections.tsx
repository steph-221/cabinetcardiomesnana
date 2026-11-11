// Sections de la fiche patient : suivi à prévoir, ordonnances, factures, examens, contenu médical.
// Elles sont assemblées en onglets par la page du dossier.

import Link from "next/link";
import {
  CalendarClock,
  ExternalLink,
  FilePlus2,
  FlaskConical,
  Stamp,
  FileText,
  MessageCircle,
  Phone,
  Pill,
  Printer,
  Receipt,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { jourLocal } from "../../../../agenda/creneaux";
import { modelesExamen } from "../../../../dossier/comptes-rendus";
import { TAILLE_MAX, typesExamen, type Examen } from "../../../../dossier/examens";
import type { Facture } from "../../../../dossier/compta";
import { libelleStatut, mad } from "../../../../dossier/compta-calculs";
import type { Ordonnance } from "../../../../dossier/ordonnances";
import { delais, suivisCourants, type SuiviPatient } from "../../../../dossier/suivis";
import type { Consultation } from "../../../../dossier/consultations";
import { libelleTabac } from "../../../../dossier/mode-de-vie";
import { lienWhatsApp, type Patient, type Traitement } from "../../../../dossier/patients";
import { couleurStatut } from "../../comptabilite/commun";
import { BoutonSupprimerExamen, ConclusionExamen, EnvoiExamens } from "../examens";
import { BoutonSupprimerOrdonnance } from "../documents";
import { BoutonSupprimerCertificat } from "../certificats";
import { titreCertificat } from "../../../../dossier/certificats-modeles";
import type { Certificat } from "../../../../dossier/certificats";
import { BoutonsTraitement, FormulaireTraitement } from "../formulaires";
import { LigneSuivi } from "../liste-suivis";
import { FormulaireSuivi } from "../suivis";

const date = (jour: string) => jour.split("-").reverse().join("/");

// Rappelle la consultation à laquelle un examen, une ordonnance ou une facture est rattaché
function LienConsultation({
  langue,
  patientId,
  consultationId,
  consultations,
}: {
  langue: string;
  patientId: number;
  consultationId: number | null;
  consultations: Consultation[];
}) {
  const c = consultationId === null ? undefined : consultations.find((x) => x.id === consultationId);
  if (!c) return null;
  return (
    <Link
      href={`/${langue}/espace/patients/${patientId}/consultation/${c.id}`}
      className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
    >
      consultation du {date(c.date)}
    </Link>
  );
}

export function Coordonnees({ patient }: { patient: Patient }) {
  const whatsapp = patient.telephone ? lienWhatsApp(patient.telephone) : null;
  return (
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
  );
}

// Poids, taille et mode de vie : à jour dans la fiche, ils sont repris par les calculs
export function ModeDeVie({ langue, patient }: { langue: string; patient: Patient }) {
  const valeur = (v: string | null) => v ?? <span className="text-slate-400">non renseigné</span>;
  const fr = (n: number | null, unite: string) => (n === null ? null : `${n.toLocaleString("fr-FR")} ${unite}`);
  return (
    <section className="rounded-2xl border border-slate-200 p-6 text-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Mode de vie</h2>
        <Link
          href={`/${langue}/espace/patients/${patient.id}/modifier`}
          className="text-xs text-slate-600 underline hover:text-slate-900"
        >
          Mettre à jour
        </Link>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Poids", fr(patient.poids, "kg")],
          ["Taille", fr(patient.taille, "cm")],
          ["Tabagisme", libelleTabac(patient.tabac, patient.paquetsAnnees) || null],
          ["Alcool", patient.alcoolVerres === null ? null : `${patient.alcoolVerres} verres par semaine`],
        ].map(([titre, v]) => (
          <div key={titre}>
            <dt className="text-slate-500">{titre}</dt>
            <dd className="text-slate-900">{valeur(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Ligne({ titre, valeur }: { titre: string; valeur: string }) {
  if (!valeur) return null;
  return (
    <div>
      <dt className="text-slate-500">{titre}</dt>
      <dd className="whitespace-pre-line text-slate-900">{valeur}</dd>
    </div>
  );
}

export function ContenuMedical({
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

      <ModeDeVie langue={langue} patient={patient} />

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

export function Examens({
  langue,
  patientId,
  examens,
  medical,
  drive,
  consultations,
  consultationDefaut,
}: {
  langue: string;
  patientId: number;
  examens: Examen[];
  medical: boolean;
  drive: boolean;
  consultations: Consultation[];
  // Consultation proposée d'emblée (on arrive de la page de la consultation)
  consultationDefaut?: number;
}) {
  // Les formulaires de compte rendu proposent la même consultation
  const suite = consultationDefaut ? `?consultation=${consultationDefaut}` : "";
  const taille = (octets: number) =>
    octets > 1024 * 1024 ? `${(octets / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(octets / 1024))} Ko`;

  return (
    <section id="examens" className="scroll-mt-36 rounded-2xl border border-slate-200 p-6 text-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <FileText className="h-5 w-5 text-red-600" aria-hidden />
          Examens
        </h2>
        <div className="flex flex-wrap gap-2">
          {medical && (
            <Link
              href={`/${langue}/espace/patients/${patientId}/ett${suite}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden />
              Compte rendu d&apos;ETT
            </Link>
          )}
          {medical &&
            modelesExamen.map((m) => (
              <Link
                key={m.cle}
                href={`/${langue}/espace/patients/${patientId}/examen/${m.cle}${suite}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden />
                {m.bouton}
              </Link>
            ))}
          {medical && (
            <Link
              href={`/${langue}/espace/patients/${patientId}/redaction${suite}`}
              className="inline-flex items-center gap-2 rounded-full border border-violet-300 px-4 py-2 text-sm text-violet-800 hover:bg-violet-50"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Rédiger par dictée
            </Link>
          )}
        </div>
      </div>
      {drive ? (
        <EnvoiExamens
          patientId={patientId}
          types={typesExamen}
          medical={medical}
          tailleMax={TAILLE_MAX}
          aujourdhui={jourLocal(new Date())}
          consultations={consultations.map((c) => ({ id: c.id, date: c.date, motif: c.motif }))}
          consultationDefaut={consultationDefaut}
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
          {examens.map((e) => {
            // Compte rendu (ETT, ECG, MAPA, effort) saisi sur le site : le PDF se regénère depuis les mesures
            const ett = Boolean(e.valeurs.ett || e.valeurs.cr);
            return (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-mono text-slate-600">{date(e.date)}</span>
                    <span className="ms-3 font-medium text-slate-900">{e.type}</span>
                    <LienConsultation
                      langue={langue}
                      patientId={patientId}
                      consultationId={e.consultationId}
                      consultations={consultations}
                    />
                    {e.fichierNom && (
                      <span className="ms-3 text-slate-400">
                        {e.fichierNom} · {taille(e.fichierTaille)}
                      </span>
                    )}
                  </p>
                  {medical && e.conclusion && <p className="mt-1 whitespace-pre-line text-slate-700">{e.conclusion}</p>}
                  {medical && !ett && (
                    <ConclusionExamen langue={langue} patientId={patientId} id={e.id} conclusion={e.conclusion} />
                  )}
                </div>
                {medical && (
                  <div className="flex items-center gap-1">
                    {ett && (
                      <a
                        href={`/api/examens/${e.id}/compte-rendu`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        <Printer className="h-3 w-3" aria-hidden />
                        Compte rendu
                      </a>
                    )}
                    {e.fichierDrive && !ett && (
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
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Suivis({ langue, patient, suivis }: { langue: string; patient: Patient; suivis: SuiviPatient[] }) {
  const aujourdhui = jourLocal(new Date());
  return (
    <section className="rounded-2xl border border-slate-200 p-6 text-sm">
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
              suivi={{
                ...s,
                nom: patient.nom,
                prenom: patient.prenom,
                sexe: patient.sexe,
                telephone: patient.telephone,
              }}
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

export function Ordonnances({
  langue,
  patientId,
  ordonnances,
  consultations,
}: {
  langue: string;
  patientId: number;
  ordonnances: Ordonnance[];
  consultations: Consultation[];
}) {
  return (
    <section id="ordonnances" className="scroll-mt-36 rounded-2xl border border-slate-200 p-6 text-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <ScrollText className="h-5 w-5 text-red-600" aria-hidden />
          Ordonnances et prescriptions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${langue}/espace/patients/${patientId}/prescription`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FlaskConical className="h-4 w-4" aria-hidden />
            Prescription d&apos;analyses
          </Link>
          <Link
            href={`/${langue}/espace/patients/${patientId}/ordonnance`}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden />
            Nouvelle ordonnance
          </Link>
        </div>
      </div>
      {ordonnances.length === 0 ? (
        <p className="text-slate-500">Aucune ordonnance ni prescription d&apos;analyses.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {ordonnances.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <span className="font-mono text-slate-600">{date(o.date)}</span>
                {o.type === "biologie" && (
                  <span className="ms-3 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">Analyses</span>
                )}
                <span className="ms-3 text-slate-900">
                  {[...o.lignes.map((l) => l.medicament), ...(o.type === "biologie" && o.remarque ? [o.remarque] : [])].join(" · ")}
                </span>
                <span className="ms-2 text-xs text-slate-400">{o.creePar}</span>
                <LienConsultation
                  langue={langue}
                  patientId={patientId}
                  consultationId={o.consultationId}
                  consultations={consultations}
                />
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`/api/ordonnances/${o.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  <Printer className="h-3 w-3" aria-hidden />
                  Imprimer
                </a>
                <BoutonSupprimerOrdonnance langue={langue} patientId={patientId} id={o.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Factures du patient : visibles aussi par la secrétaire, qui encaisse
export function FacturesPatient({
  langue,
  patientId,
  factures,
  consultations,
}: {
  langue: string;
  patientId: number;
  factures: Facture[];
  consultations: Consultation[];
}) {
  const base = `/${langue}/espace/comptabilite/factures`;
  const reste = factures.filter((f) => !f.annulee).reduce((somme, f) => somme + f.totalCts - f.payeCts, 0);
  return (
    <section id="factures" className="scroll-mt-36 rounded-2xl border border-slate-200 p-6 text-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Receipt className="h-5 w-5 text-red-600" aria-hidden />
          Factures
          {reste > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              reste à payer : {mad(reste)}
            </span>
          )}
        </h2>
        <Link
          href={`${base}/nouvelle?patient=${patientId}`}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden />
          Nouvelle facture
        </Link>
      </div>
      {factures.length === 0 ? (
        <p className="text-slate-500">Aucune facture.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {factures.map((f) => (
            <li key={f.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${f.annulee ? "text-slate-400" : ""}`}>
              <div>
                <span className="font-mono text-slate-600">{date(f.date)}</span>
                <Link href={`${base}/${f.id}`} className="ms-3 font-mono text-red-700 hover:underline">
                  {f.numero}
                </Link>
                <LienConsultation
                  langue={langue}
                  patientId={patientId}
                  consultationId={f.consultationId}
                  consultations={consultations}
                />
                <span className="ms-3">{f.lignes.map((l) => l.libelle).join(" · ")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-slate-900">{mad(f.totalCts)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${couleurStatut[f.statut]}`}>{libelleStatut[f.statut]}</span>
                <a
                  href={`/api/factures/${f.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  <Printer className="h-3 w-3" aria-hidden />
                  PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Certificats({
  langue,
  patientId,
  certificats,
  consultations,
}: {
  langue: string;
  patientId: number;
  certificats: Certificat[];
  consultations: Consultation[];
}) {
  return (
    <section id="certificats" className="scroll-mt-36 rounded-2xl border border-slate-200 p-6 text-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Stamp className="h-5 w-5 text-red-600" aria-hidden />
          Certificats
        </h2>
        <Link
          href={`/${langue}/espace/patients/${patientId}/certificat`}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden />
          Nouveau certificat
        </Link>
      </div>
      {certificats.length === 0 ? (
        <p className="text-slate-500">Aucun certificat.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {certificats.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <span className="font-mono text-slate-600">{date(c.date)}</span>
                <span className="ms-3 text-slate-900">{titreCertificat(c.modele)}</span>
                <span className="ms-2 text-xs text-slate-400">{c.creePar}</span>
                <LienConsultation
                  langue={langue}
                  patientId={patientId}
                  consultationId={c.consultationId}
                  consultations={consultations}
                />
              </div>
              <div className="flex items-center gap-1">
                {(["A5", "A4"] as const).map((format) => (
                  <a
                    key={format}
                    href={`/api/certificats/${c.id}/pdf?format=${format}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <Printer className="h-3 w-3" aria-hidden />
                    Imprimer {format}
                  </a>
                ))}
                <BoutonSupprimerCertificat langue={langue} patientId={patientId} id={c.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

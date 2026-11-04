// Aperçu du dossier : ce que le médecin veut voir en premier quand le patient est là.
// Valeurs clés, dernière consultation, traitements en cours, facteurs de risque, suivi à prévoir.

import Link from "next/link";
import { ClipboardPlus, Pill, Printer, Stethoscope } from "lucide-react";
import { dfg, imc, surfaceCorporelle } from "../../../../dossier/calculs";
import type { DonneesDossier } from "../../../../dossier/calculateurs/preremplissage";
import type { Facture } from "../../../../dossier/compta";
import { mad } from "../../../../dossier/compta-calculs";
import type { Consultation } from "../../../../dossier/consultations";
import { libelleTabac } from "../../../../dossier/mode-de-vie";
import type { Patient, Traitement } from "../../../../dossier/patients";
import type { SuiviPatient } from "../../../../dossier/suivis";
import { ChipsConsultation, type Liens } from "./suivi";
import { Coordonnees, Suivis } from "./sections";

const jour = (d: string) => d.split("-").reverse().join("/");
const fr = (n: number, chiffres = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: chiffres });

type Valeur = { titre: string; valeur: string | null; indice?: string };

function ValeursCles({ langue, patient, donnees, consultations }: {
  langue: string;
  patient: Patient;
  donnees: DonneesDossier;
  consultations: Consultation[];
}) {
  // Dernière fois que la valeur a été prise en consultation
  const derniere = (valeur: (c: Consultation) => string | null) => {
    for (const c of consultations) {
      const v = valeur(c);
      if (v) return { v, date: c.date };
    }
    return null;
  };
  const ta = derniere((c) => (c.taSys && c.taDia ? `${c.taSys}/${c.taDia} mmHg` : null));
  const fc = derniere((c) => (c.fc ? `${c.fc} bpm` : null));
  const spo2 = derniere((c) => (c.spo2 ? `${c.spo2} %` : null));
  const sc = surfaceCorporelle(donnees.poids, donnees.taille);
  const masse = imc(donnees.poids, donnees.taille);
  const debit = dfg(donnees.creatinine, donnees.age, donnees.sexe);

  const valeurs: Valeur[] = [
    { titre: "Poids", valeur: donnees.poids !== null ? `${fr(donnees.poids)} kg` : null, indice: donnees.poidsOrigine },
    { titre: "Taille", valeur: donnees.taille !== null ? `${fr(donnees.taille, 0)} cm` : null, indice: donnees.tailleOrigine },
    { titre: "IMC", valeur: masse ? `${fr(masse)} kg/m²` : null },
    { titre: "Surface corporelle", valeur: sc ? `${fr(sc, 2)} m²` : null },
    { titre: "DFG (CKD-EPI 2021)", valeur: debit ? `${Math.round(debit)} mL/min/1,73 m²` : null, indice: debit ? donnees.creatinineOrigine : undefined },
    { titre: "FEVG", valeur: donnees.fevg !== null ? `${fr(donnees.fevg, 0)} %` : null, indice: donnees.fevgOrigine },
    { titre: "Tension", valeur: ta?.v ?? null, indice: ta ? `le ${jour(ta.date)}` : undefined },
    { titre: "Fréquence cardiaque", valeur: fc?.v ?? null, indice: fc ? `le ${jour(fc.date)}` : undefined },
    { titre: "SpO₂", valeur: spo2?.v ?? null, indice: spo2 ? `le ${jour(spo2.date)}` : undefined },
    { titre: "Tabagisme", valeur: libelleTabac(patient.tabac, patient.paquetsAnnees) || null },
    { titre: "Alcool", valeur: patient.alcoolVerres !== null ? `${patient.alcoolVerres} verres/sem.` : null },
  ];
  // Poids et taille restent affichés même vides : ce sont eux qui manquent le plus aux calculs
  const affichees = valeurs.filter((v) => v.valeur !== null || v.titre === "Poids" || v.titre === "Taille");

  return (
    <section className="rounded-2xl border border-slate-200 p-6 text-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Valeurs clés</h2>
        <Link
          href={`/${langue}/espace/patients/${patient.id}/modifier`}
          className="text-xs text-slate-600 underline hover:text-slate-900"
        >
          Mettre à jour poids, taille…
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {affichees.map((v) => (
          <div key={v.titre}>
            <dt className="text-slate-500">{v.titre}</dt>
            <dd className="font-semibold text-slate-900">
              {v.valeur ?? <span className="font-normal text-slate-400">à renseigner</span>}
            </dd>
            {v.indice && <dd className="text-xs text-slate-400">{v.indice}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function DerniereConsultation({ langue, patient, consultation, liens }: {
  langue: string;
  patient: Patient;
  consultation: Consultation | undefined;
  liens: Liens;
}) {
  const nouvelle = `/${langue}/espace/patients/${patient.id}/consultation`;
  return (
    <section className="rounded-2xl border border-slate-200 p-6 text-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Stethoscope className="h-5 w-5 text-red-600" aria-hidden />
          Dernière consultation
        </h2>
        {/* L'en-tête du dossier propose déjà « Nouvelle consultation » : ici seulement s'il n'y en a encore aucune */}
        {!consultation && (
          <Link
            href={nouvelle}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <ClipboardPlus className="h-4 w-4" aria-hidden />
            Nouvelle consultation
          </Link>
        )}
      </div>
      {!consultation ? (
        <p className="text-slate-500">Aucune consultation enregistrée.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p>
              <Link
                href={`${nouvelle}/${consultation.id}`}
                className="font-semibold text-slate-900 hover:text-red-700"
              >
                {jour(consultation.date)}
              </Link>
              {consultation.motif && <span className="ms-2 text-slate-600">{consultation.motif}</span>}
            </p>
            <a
              href={`/api/consultations/${consultation.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
            >
              <Printer className="h-3 w-3" aria-hidden />
              Rapport PDF
            </a>
          </div>
          {consultation.conclusion && (
            <p className="mt-2 whitespace-pre-line text-slate-700">
              <span className="font-medium text-slate-500">Conclusion : </span>
              {consultation.conclusion}
            </p>
          )}
          {consultation.conduite && (
            <p className="mt-1 whitespace-pre-line text-slate-700">
              <span className="font-medium text-slate-500">Conduite : </span>
              {consultation.conduite}
            </p>
          )}
          <ChipsConsultation langue={langue} patientId={patient.id} consultationId={consultation.id} liens={liens} />
          <p className="mt-3">
            <Link
              href={`/${langue}/espace/patients/${patient.id}?onglet=consultations`}
              className="text-xs text-slate-600 underline hover:text-slate-900"
            >
              Voir toutes les consultations
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

function ResteAPayer({ langue, patientId, factures }: { langue: string; patientId: number; factures: Facture[] | null }) {
  const reste = (factures ?? []).filter((f) => !f.annulee).reduce((somme, f) => somme + f.totalCts - f.payeCts, 0);
  if (reste <= 0) return null;
  return (
    <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
      Reste à payer : <strong>{mad(reste)}</strong>.{" "}
      <Link href={`/${langue}/espace/patients/${patientId}?onglet=documents`} className="underline">
        Voir les factures
      </Link>
    </p>
  );
}

export function Apercu({
  langue,
  patient,
  medical,
  donnees,
  consultations,
  traitements,
  suivis,
  factures,
  liens,
}: {
  langue: string;
  patient: Patient;
  medical: boolean;
  donnees: DonneesDossier;
  consultations: Consultation[];
  traitements: Traitement[];
  suivis: SuiviPatient[];
  factures: Facture[] | null;
  liens: Liens;
}) {
  if (!medical) {
    // La secrétaire : coordonnées, suivis à relancer, reste à payer
    return (
      <div className="mt-6 space-y-6">
        <ResteAPayer langue={langue} patientId={patient.id} factures={factures} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Coordonnees patient={patient} />
          <div className="lg:col-span-2">
            <Suivis langue={langue} patient={patient} suivis={suivis} />
          </div>
        </div>
      </div>
    );
  }

  const enCours = traitements.filter((t) => !t.fin);
  const fiche = `/${langue}/espace/patients/${patient.id}?onglet=fiche`;
  return (
    <div className="mt-6 space-y-6">
      <ResteAPayer langue={langue} patientId={patient.id} factures={factures} />
      <ValeursCles langue={langue} patient={patient} donnees={donnees} consultations={consultations} />
      <DerniereConsultation langue={langue} patient={patient} consultation={consultations[0]} liens={liens} />

      <div className="grid gap-6 lg:grid-cols-2">
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
                <li key={t.id} className="py-2">
                  <span className="font-medium text-slate-900">{t.medicament}</span>
                  {t.posologie && <span className="ms-2 text-slate-600">{t.posologie}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3">
            <Link href={fiche} className="text-xs text-slate-600 underline hover:text-slate-900">
              Gérer les traitements
            </Link>
          </p>
        </section>

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
          {patient.antecedents && (
            <p className="mt-3 line-clamp-4 whitespace-pre-line text-slate-900">{patient.antecedents}</p>
          )}
          <p className="mt-3">
            <Link href={fiche} className="text-xs text-slate-600 underline hover:text-slate-900">
              Voir la fiche complète
            </Link>
          </p>
        </section>
      </div>

      <Suivis langue={langue} patient={patient} suivis={suivis} />
    </div>
  );
}

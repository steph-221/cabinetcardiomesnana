// Suivi médical du dossier : alertes, calculs, courbes d'évolution et consultations (médecins seulement)

import Link from "next/link";
import { Activity, ClipboardPlus, OctagonAlert, Printer, Stethoscope, TriangleAlert } from "lucide-react";
import type { Alerte } from "../../../../dossier/calculs";
import { mesures, type Consultation } from "../../../../dossier/consultations";
import type { Patient } from "../../../../dossier/patients";
import type { Facture } from "../../../../dossier/compta";
import { libelleStatut } from "../../../../dossier/compta-calculs";
import type { Examen } from "../../../../dossier/examens";
import type { Ordonnance } from "../../../../dossier/ordonnances";
import type { ScorePatient } from "../../../../dossier/scores-patients";
import { couleurStatut } from "../../comptabilite/commun";
import { Courbe, couleurs, type Serie } from "../courbe";

const jour = (d: string) => d.split("-").reverse().join("/");
const fr = (n: number, chiffres = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: chiffres });

export function Alertes({ alertes }: { alertes: Alerte[] }) {
  if (!alertes.length) return null;
  return (
    <ul className="mt-6 space-y-2" aria-label="Alertes">
      {alertes.map((a, i) => (
        <li
          key={i}
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            a.niveau === "critique" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"
          }`}
        >
          {a.niveau === "critique" ? (
            <OctagonAlert className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
          )}
          <span>
            <span className="font-semibold">{a.niveau === "critique" ? "Critique" : "Attention"} : </span>
            {a.texte}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Valeurs d'une consultation, de la plus ancienne à la plus récente, pour les courbes
function serie(
  consultations: Consultation[],
  nom: string,
  couleur: string,
  valeur: (c: Consultation) => number | null | undefined,
): Serie {
  return {
    nom,
    couleur,
    points: [...consultations].reverse().flatMap((c) => {
      const v = valeur(c);
      return v === null || v === undefined ? [] : [{ date: c.date, valeur: v }];
    }),
  };
}

// Ce qui se rapporte aux consultations (calculs, examens, ordonnances, factures)
export type Liens = { scores: ScorePatient[]; examens: Examen[]; ordonnances: Ordonnance[]; factures: Facture[] };

// Petits repères sous une consultation : ce qui lui est rattaché, avec un lien vers la consultation
export function ChipsConsultation({
  langue,
  patientId,
  consultationId,
  liens,
}: {
  langue: string;
  patientId: number;
  consultationId: number;
  liens: Liens;
}) {
  const ici = <T extends { consultationId: number | null }>(liste: T[]) =>
    liste.filter((e) => e.consultationId === consultationId);
  const scores = ici(liens.scores);
  const examens = ici(liens.examens);
  const ordonnances = ici(liens.ordonnances);
  const factures = ici(liens.factures);
  if (!scores.length && !examens.length && !ordonnances.length && !factures.length) return null;
  const href = `/${langue}/espace/patients/${patientId}/consultation/${consultationId}`;
  const chip = "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200";
  const nombre = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
  return (
    <p className="mt-2 flex flex-wrap gap-2">
      {scores.length > 0 && (
        <Link href={href} className={chip}>
          {nombre(scores.length, "calcul", "calculs")}
        </Link>
      )}
      {examens.length > 0 && (
        <Link href={href} className={chip}>
          {nombre(examens.length, "examen", "examens")}
        </Link>
      )}
      {ordonnances.length > 0 && (
        <Link href={href} className={chip}>
          {nombre(ordonnances.length, "ordonnance", "ordonnances")}
        </Link>
      )}
      {factures.map((f) => (
        <Link key={f.id} href={href} className={`rounded-full px-2 py-0.5 text-xs ${couleurStatut[f.statut]}`}>
          Facture {f.numero} · {libelleStatut[f.statut]}
        </Link>
      ))}
    </p>
  );
}

export function CourbesEvolution({
  patient,
  consultations,
  fevgEchos,
}: {
  patient: Patient;
  consultations: Consultation[];
  fevgEchos: { date: string; valeur: number }[];
}) {
  const courbes = [
    {
      titre: "INR",
      unite: "",
      series: [serie(consultations, "INR", couleurs[0], (c) => c.mesures.inr)],
      bande:
        patient.inrMin !== null && patient.inrMax !== null ? { min: patient.inrMin, max: patient.inrMax } : undefined,
    },
    {
      titre: "Tension artérielle",
      unite: "mmHg",
      series: [
        serie(consultations, "Systolique", couleurs[0], (c) => c.taSys),
        serie(consultations, "Diastolique", couleurs[1], (c) => c.taDia),
      ],
    },
    { titre: "Fréquence cardiaque", unite: "bpm", series: [serie(consultations, "FC", couleurs[0], (c) => c.fc)] },
    { titre: "Poids", unite: "kg", series: [serie(consultations, "Poids", couleurs[0], (c) => c.poids)] },
    ...mesures
      .filter((m) => m.cle !== "inr")
      .map((m) => {
        const s = serie(consultations, m.libelle, couleurs[0], (c) => c.mesures[m.cle]);
        // La FEVG des comptes rendus d'ETT s'ajoute à celle notée en consultation
        if (m.cle === "fevg") s.points = [...s.points, ...fevgEchos].sort((a, b) => a.date.localeCompare(b.date));
        return { titre: m.libelle, unite: m.unite, series: [s] };
      }),
  ].filter((c) => c.series.some((s) => s.points.length > 0));

  if (courbes.length === 0)
    return (
      <section className="rounded-2xl border border-slate-200 p-6 text-sm">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Activity className="h-5 w-5 text-red-600" aria-hidden />
          Évolution
        </h2>
        <p className="text-slate-500">Les courbes apparaîtront dès que des valeurs auront été saisies en consultation.</p>
      </section>
    );
  return (
    <section className="rounded-2xl border border-slate-200 p-6 text-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Activity className="h-5 w-5 text-red-600" aria-hidden />
        Évolution
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courbes.map((c) => (
          <Courbe key={c.titre} titre={c.titre} unite={c.unite} series={c.series} bande={c.bande} />
        ))}
      </div>
    </section>
  );
}

export function ListeConsultations({
  langue,
  patient,
  consultations,
  liens,
}: {
  langue: string;
  patient: Patient;
  consultations: Consultation[];
  liens: Liens;
}) {
  return (
      <section className="rounded-2xl border border-slate-200 p-6 text-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Stethoscope className="h-5 w-5 text-red-600" aria-hidden />
            Consultations
          </h2>
          <Link
            href={`/${langue}/espace/patients/${patient.id}/consultation`}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <ClipboardPlus className="h-4 w-4" aria-hidden />
            Nouvelle consultation
          </Link>
        </div>
        {consultations.length === 0 ? (
          <p className="text-slate-500">Aucune consultation enregistrée.</p>
        ) : (
          <ol className="space-y-4 border-s-2 border-slate-100 ps-4">
            {consultations.map((c) => (
              <li key={c.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p>
                    <Link
                      href={`/${langue}/espace/patients/${patient.id}/consultation/${c.id}`}
                      className="font-semibold text-slate-900 hover:text-red-700"
                    >
                      {jour(c.date)}
                    </Link>
                    {c.motif && <span className="ms-2 text-slate-600">{c.motif}</span>}
                  </p>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {c.creePar}
                    <a
                      href={`/api/consultations/${c.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
                    >
                      <Printer className="h-3 w-3" aria-hidden />
                      Rapport PDF
                    </a>
                  </span>
                </div>
                <p className="mt-1 text-slate-700">
                  {[
                    c.taSys && c.taDia && `TA ${c.taSys}/${c.taDia} mmHg`,
                    c.fc && `FC ${c.fc} bpm`,
                    c.spo2 && `SpO₂ ${c.spo2} %`,
                    c.poids && `${fr(c.poids)} kg`,
                    ...mesures.flatMap((m) =>
                      c.mesures[m.cle] !== undefined
                        ? [`${m.libelle} ${fr(c.mesures[m.cle]!, 2)}${m.unite ? ` ${m.unite}` : ""}`]
                        : [],
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {c.examen && <Rubrique titre="Examen" texte={c.examen} />}
                {c.ecg && <Rubrique titre="ECG" texte={c.ecg} />}
                {c.echo && <Rubrique titre="Échographie cardiaque" texte={c.echo} />}
                {c.autres && <Rubrique titre="Autres" texte={c.autres} />}
                {c.conclusion && <Rubrique titre="Conclusion" texte={c.conclusion} />}
                {c.conduite && <Rubrique titre="Conduite" texte={c.conduite} />}
                <ChipsConsultation langue={langue} patientId={patient.id} consultationId={c.id} liens={liens} />
              </li>
            ))}
          </ol>
        )}
      </section>
  );
}

function Rubrique({ titre, texte }: { titre: string; texte: string }) {
  return (
    <p className="mt-1 whitespace-pre-line text-slate-700">
      <span className="font-medium text-slate-500">{titre} : </span>
      {texte}
    </p>
  );
}

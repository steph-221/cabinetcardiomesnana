// Suivi médical du dossier : alertes, calculs, courbes d'évolution et consultations (médecins seulement)

import Link from "next/link";
import { Activity, Calculator, ClipboardPlus, OctagonAlert, Stethoscope, TriangleAlert } from "lucide-react";
import { dfg, imc, surfaceCorporelle, type Alerte } from "../../../../dossier/calculs";
import { mesures, type Consultation } from "../../../../dossier/consultations";
import type { Patient } from "../../../../dossier/patients";
import { Courbe, couleurs, type Serie } from "../courbe";
import { CalculCha2ds2va } from "../scores";

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
function serie(consultations: Consultation[], nom: string, couleur: string, valeur: (c: Consultation) => number | null | undefined): Serie {
  return {
    nom,
    couleur,
    points: [...consultations]
      .reverse()
      .flatMap((c) => {
        const v = valeur(c);
        return v === null || v === undefined ? [] : [{ date: c.date, valeur: v }];
      }),
  };
}

export function SuiviMedical({
  langue,
  patient,
  age,
  consultations,
}: {
  langue: string;
  patient: Patient;
  age: number | null;
  consultations: Consultation[];
}) {
  // Dernières valeurs connues (consultations de la plus récente à la plus ancienne)
  const poids = consultations.find((c) => c.poids !== null)?.poids ?? null;
  const taille = consultations.find((c) => c.taille !== null)?.taille ?? null;
  const creatinine = consultations.find((c) => c.mesures.creatinine !== undefined)?.mesures.creatinine ?? null;
  const sc = surfaceCorporelle(poids, taille);
  const masse = imc(poids, taille);
  const debit = dfg(creatinine, age, patient.sexe);

  const courbes = [
    {
      titre: "INR",
      unite: "",
      series: [serie(consultations, "INR", couleurs[0], (c) => c.mesures.inr)],
      bande: patient.inrMin !== null && patient.inrMax !== null ? { min: patient.inrMin, max: patient.inrMax } : undefined,
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
      .map((m) => ({
        titre: m.libelle,
        unite: m.unite,
        series: [serie(consultations, m.libelle, couleurs[0], (c) => c.mesures[m.cle])],
      })),
  ].filter((c) => c.series.some((s) => s.points.length > 0));

  // Pré-remplissage du score à partir du dossier
  const preCoches = [
    patient.facteursRisque.includes("HTA") && "hta",
    patient.facteursRisque.includes("Diabète") && "diabete",
    age !== null && age >= 75 && "age75",
    age !== null && age >= 65 && age < 75 && "age65",
  ].filter((c): c is string => Boolean(c));

  return (
    <>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 p-6 text-sm">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Calculator className="h-5 w-5 text-red-600" aria-hidden />
            Calculs
          </h2>
          <dl className="space-y-2">
            <Valeur titre="Surface corporelle" valeur={sc && `${fr(sc, 2)} m²`} />
            <Valeur titre="IMC" valeur={masse && `${fr(masse)} kg/m²`} />
            <Valeur
              titre="DFG estimé (CKD-EPI 2021)"
              valeur={debit && `${Math.round(debit)} mL/min/1,73 m²`}
              manque={!creatinine ? "créatinine non renseignée" : !patient.sexe || age === null ? "sexe ou âge manquant" : undefined}
            />
          </dl>
          <p className="mt-3 text-xs text-slate-400">D&apos;après les dernières valeurs saisies en consultation.</p>
        </section>
        <section className="rounded-2xl border border-slate-200 p-6 text-sm lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Score CHA₂DS₂-VA</h2>
          <CalculCha2ds2va preCoches={preCoches} />
        </section>
      </div>

      {courbes.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 p-6 text-sm">
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
      )}

      <section id="consultations" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 p-6 text-sm">
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
                  <span className="text-xs text-slate-400">{c.creePar}</span>
                </div>
                <p className="mt-1 text-slate-700">
                  {[
                    c.taSys && c.taDia && `TA ${c.taSys}/${c.taDia} mmHg`,
                    c.fc && `FC ${c.fc} bpm`,
                    c.spo2 && `SpO₂ ${c.spo2} %`,
                    c.poids && `${fr(c.poids)} kg`,
                    ...mesures.flatMap((m) =>
                      c.mesures[m.cle] !== undefined ? [`${m.libelle} ${fr(c.mesures[m.cle]!, 2)}${m.unite ? ` ${m.unite}` : ""}`] : [],
                    ),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {c.examen && <Rubrique titre="Examen" texte={c.examen} />}
                {c.ecg && <Rubrique titre="ECG" texte={c.ecg} />}
                {c.autres && <Rubrique titre="Autres" texte={c.autres} />}
                {c.conclusion && <Rubrique titre="Conclusion" texte={c.conclusion} />}
                {c.conduite && <Rubrique titre="Conduite" texte={c.conduite} />}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Valeur({ titre, valeur, manque }: { titre: string; valeur: string | null | 0; manque?: string }) {
  return (
    <div>
      <dt className="text-slate-500">{titre}</dt>
      <dd className="font-medium text-slate-900">{valeur || <span className="font-normal text-slate-400">{manque ?? "—"}</span>}</dd>
    </div>
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

// Calculs enregistrés dans le dossier : pour chaque calcul, l'historique daté et la courbe d'évolution du score

import { Calculator } from "lucide-react";
import { trouverCalculateur } from "../../../dossier/calculateurs";
import type { DonneesDossier } from "../../../dossier/calculateurs/preremplissage";
import { dfg, imc, surfaceCorporelle } from "../../../dossier/calculs";
import type { Valeurs } from "../../../dossier/calculateurs/types";
import type { ScorePatient } from "../../../dossier/scores-patients";
import { Courbe, couleurs } from "./courbe";
import { BoutonRetirerScore } from "./scores-formulaire";

const jour = (d: string) => d.split("-").reverse().join("/");

// Réponses résumées en une ligne, dans l'ordre du formulaire
function resume(slug: string, valeurs: Valeurs) {
  const calculateur = trouverCalculateur(slug);
  if (!calculateur) return "";
  const morceaux: string[] = [];
  for (const c of calculateur.champs) {
    const v = valeurs[c.cle];
    if (c.type === "case" && v === true) morceaux.push(c.libelle);
    else if (c.type === "choix") {
      const option = c.options.find((o) => o.valeur === v);
      if (option && option !== c.options[0]) morceaux.push(`${c.libelle} : ${option.libelle}`);
    } else if (c.type === "nombre" && typeof v === "number") morceaux.push(`${c.libelle} : ${v} ${c.unite ?? ""}`.trim());
  }
  return morceaux.join(" · ");
}

// Valeurs dérivées des données du dossier : surface, IMC, DFG (CKD-EPI 2021)
export function ValeursCalculees({ donnees }: { donnees: DonneesDossier }) {
  const fr = (n: number, chiffres = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: chiffres });
  const sc = surfaceCorporelle(donnees.poids, donnees.taille);
  const masse = imc(donnees.poids, donnees.taille);
  const debit = dfg(donnees.creatinine, donnees.age, donnees.sexe);
  const manqueMesure = !donnees.poids || !donnees.taille ? "poids ou taille manquant" : undefined;
  const manqueDfg = !donnees.creatinine
    ? "créatinine non renseignée"
    : !donnees.sexe || donnees.age === null
      ? "sexe ou âge manquant"
      : undefined;
  const lignes = [
    { titre: "Surface corporelle", valeur: sc && `${fr(sc, 2)} m²`, manque: manqueMesure },
    { titre: "IMC", valeur: masse && `${fr(masse)} kg/m²`, manque: manqueMesure },
    { titre: "DFG estimé (CKD-EPI 2021)", valeur: debit && `${Math.round(debit)} mL/min/1,73 m²`, manque: manqueDfg },
  ];
  return (
    <dl className="mb-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
      {lignes.map((l) => (
        <div key={l.titre}>
          <dt className="text-slate-500">{l.titre}</dt>
          <dd className="font-semibold text-slate-900">{l.valeur || <span className="font-normal text-slate-400">{l.manque}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ScoresDossier({
  langue,
  patientId,
  scores,
}: {
  langue: string;
  patientId: number;
  scores: ScorePatient[];
}) {
  if (!scores.length) return <p className="text-slate-500">Aucun calcul enregistré dans ce dossier.</p>;

  // Regroupement par calcul, le plus récent en premier
  const parCalcul = new Map<string, ScorePatient[]>();
  for (const s of scores) parCalcul.set(s.slug, [...(parCalcul.get(s.slug) ?? []), s]);

  return (
    <div className="space-y-6">
      {[...parCalcul].map(([slug, liste]) => {
        const chronologique = [...liste].reverse();
        const numeriques = chronologique.filter((s) => s.score !== null);
        return (
          <div key={slug}>
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <Calculator className="h-4 w-4 text-red-600" aria-hidden />
              {liste[0].titre}
              <span className="text-xs font-normal text-slate-500">
                {liste.length} calcul{liste.length > 1 ? "s" : ""}
              </span>
            </h3>

            {numeriques.length >= 2 && (
              <div className="mt-3 max-w-md">
                <Courbe
                  titre={`Évolution — ${liste[0].titre}`}
                  unite=""
                  series={[
                    {
                      nom: liste[0].titre,
                      couleur: couleurs[0],
                      points: numeriques.map((s) => ({ date: s.date, valeur: s.score as number })),
                    },
                  ]}
                />
              </div>
            )}

            <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {liste.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-slate-900">
                      <span className="font-medium">{jour(s.date)}</span>
                      {" · "}
                      {s.score !== null && (
                        <>
                          Score <strong>{s.score}</strong> ·{" "}
                        </>
                      )}
                      {s.libelle}
                    </p>
                    {resume(s.slug, s.valeurs) && (
                      <p className="mt-0.5 text-xs text-slate-500">{resume(s.slug, s.valeurs)}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">Saisi par {s.creePar || "—"}</p>
                  </div>
                  <BoutonRetirerScore langue={langue} patientId={patientId} id={s.id} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Calculs enregistrés dans le dossier : pour chaque calcul, l'historique daté et la courbe d'évolution du score

import { Calculator } from "lucide-react";
import { trouverCalculateur } from "../../../dossier/calculateurs";
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

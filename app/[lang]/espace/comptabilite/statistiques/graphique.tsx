"use client";

import { useState } from "react";
import { mad } from "../../../../dossier/compta-calculs";
import { echelle, repereCourt, somme } from "../../../../dossier/compta-stats-calculs";

export type SerieGraphique = { id: string; nom: string; couleur: string };
export type SeauGraphique = { cle: string; court: string; long: string; annee: string | null };

const HAUTEUR = 208; // hauteur du tracé ; les repères de l'axe horizontal s'ajoutent en dessous
const MAX_REPERES_X = 12;

const nombre = new Intl.NumberFormat("fr-FR");

// Colonnes empilées : une colonne par jour / semaine / mois, un segment par médecin.
// Les segments se touchent à 2 px d'écart (jamais de bordure), le haut de la pile est arrondi, le bas est droit.
// Chaque colonne est sa propre cible : survol et clavier donnent le détail, et le tableau reprend toutes les valeurs.
export function GraphiqueEmpile({
  titre,
  description,
  format,
  unite,
  seaux,
  series,
  valeurs,
}: {
  titre: string;
  description?: string;
  format: "mad" | "nombre";
  unite?: [string, string]; // [singulier, pluriel], pour les nombres
  seaux: SeauGraphique[];
  series: SerieGraphique[];
  valeurs: number[][]; // [colonne][série] ; en centimes pour les montants
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const [masquees, setMasquees] = useState<string[]>([]);
  const [vue, setVue] = useState<"graphique" | "tableau">("graphique");

  const texte = (v: number) =>
    format === "mad" ? mad(v, true) : `${nombre.format(v)}${unite ? ` ${v > 1 ? unite[1] : unite[0]}` : ""}`;

  const visibles = series.map((s) => !masquees.includes(s.id));
  const totalSerie = series.map((_, j) => somme(valeurs.map((ligne) => ligne[j])));
  const totalColonne = valeurs.map((ligne) => somme(ligne.filter((_, j) => visibles[j])));
  const grandTotal = somme(totalColonne);
  const pic = totalColonne.reduce((m, v, i) => (v > totalColonne[m] ? i : m), 0);

  // Axe : repères ronds, exprimés en dirhams pour les montants
  const diviseur = format === "mad" ? 100 : 1;
  const { haut, reperes } = echelle(Math.max(0, ...totalColonne) / diviseur);
  const enMilliers = haut >= 10000;
  const pas = Math.ceil(seaux.length / MAX_REPERES_X);

  const basculer = (id: string) => setMasquees((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const resume = (i: number) =>
    `${seaux[i].long} : ${texte(totalColonne[i])}` +
    (series.length > 1
      ? ` (${series
          .map((s, j) => (visibles[j] && valeurs[i][j] > 0 ? `${s.nom} ${texte(valeurs[i][j])}` : null))
          .filter(Boolean)
          .join(", ")})`
      : "");

  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <figcaption className="text-base font-semibold text-slate-900">{titre}</figcaption>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        <div role="group" aria-label={`Affichage : ${titre}`} className="inline-flex shrink-0 rounded-full border border-slate-300 p-0.5 text-xs">
          {(["graphique", "tableau"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={vue === v}
              onClick={() => setVue(v)}
              className={`rounded-full px-3 py-1 capitalize ${vue === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Légende : cliquez pour masquer un médecin">
          {series.map((s, j) => (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={visibles[j]}
                onClick={() => basculer(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-50 ${visibles[j] ? "" : "opacity-45"}`}
              >
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.couleur }} aria-hidden />
                <span className="text-slate-600">{s.nom}</span>
                <span className="font-medium text-slate-900">{texte(totalSerie[j])}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {grandTotal === 0 ? (
        <p className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Aucune donnée sur cette période.</p>
      ) : vue === "graphique" ? (
        <>
          <p className="mt-3 text-xs text-slate-500">
            Pic : <span className="text-slate-700">{seaux[pic].long}</span> ·{" "}
            <span className="font-medium text-slate-900">{texte(totalColonne[pic])}</span>
          </p>
          <div className="mt-3 flex">
            <div className="relative w-11 shrink-0 sm:w-14" style={{ height: HAUTEUR }} aria-hidden>
              {reperes.map((v) => (
                <span
                  key={v}
                  className="absolute right-2 translate-y-1/2 text-[11px] text-slate-500 tabular-nums"
                  style={{ bottom: `${(v / haut) * 100}%` }}
                >
                  {repereCourt(v, enMilliers)}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative" style={{ height: HAUTEUR }}>
                {reperes.map((v) => (
                  <div
                    key={v}
                    className="absolute inset-x-0 border-t"
                    style={{ bottom: `${(v / haut) * 100}%`, borderColor: v === 0 ? "var(--viz-axe)" : "var(--viz-grille)" }}
                    aria-hidden
                  />
                ))}
                <div className="absolute inset-0 flex" onPointerLeave={() => setSurvol(null)}>
                  {seaux.map((s, i) => {
                    const segments = series
                      .map((serie, j) => ({ serie, valeur: valeurs[i][j], visible: visibles[j] }))
                      .filter((x) => x.visible && x.valeur > 0);
                    return (
                      <div
                        key={s.cle}
                        role="img"
                        tabIndex={0}
                        aria-label={resume(i)}
                        onPointerEnter={() => setSurvol(i)}
                        onFocus={() => setSurvol(i)}
                        onBlur={() => setSurvol(null)}
                        className={`flex h-full min-w-0 flex-1 items-end justify-center px-px outline-offset-[-2px] ${survol === i ? "bg-slate-100/70" : ""}`}
                      >
                        <div
                          className="flex w-full max-w-6 flex-col-reverse gap-0.5"
                          style={{ height: `${(totalColonne[i] / diviseur / haut) * 100}%`, filter: survol === i ? "brightness(1.08)" : undefined }}
                        >
                          {segments.map((x, k) => (
                            <div
                              key={x.serie.id}
                              style={{
                                flex: `${x.valeur} 1 0`,
                                minHeight: 2,
                                background: x.serie.couleur,
                                borderTopLeftRadius: k === segments.length - 1 ? 4 : 0,
                                borderTopRightRadius: k === segments.length - 1 ? 4 : 0,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {survol !== null && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute top-0 z-10 w-max min-w-44 max-w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"
                    style={
                      (survol + 0.5) / seaux.length < 0.55
                        ? { left: `calc(${((survol + 0.5) / seaux.length) * 100}% + 14px)` }
                        : { right: `calc(${(1 - (survol + 0.5) / seaux.length) * 100}% + 14px)` }
                    }
                  >
                    <p className="font-medium text-slate-500">{seaux[survol].long}</p>
                    <ul className="mt-1.5 space-y-1">
                      {series.map((s, j) =>
                        visibles[j] && valeurs[survol][j] > 0 ? (
                          <li key={s.id} className="flex items-center gap-2">
                            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.couleur }} aria-hidden />
                            <span className="font-semibold text-slate-900">{texte(valeurs[survol][j])}</span>
                            <span className="truncate text-slate-500">{s.nom}</span>
                          </li>
                        ) : null,
                      )}
                      {totalColonne[survol] === 0 && <li className="text-slate-500">Aucune donnée</li>}
                    </ul>
                    {visibles.filter(Boolean).length > 1 && totalColonne[survol] > 0 && (
                      <p className="mt-2 border-t border-slate-100 pt-1.5 text-slate-500">
                        Total <span className="font-semibold text-slate-900">{texte(totalColonne[survol])}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex" aria-hidden>
                {seaux.map((s, i) => (
                  <div key={s.cle} className="min-w-0 flex-1 pt-1.5 text-center text-[10px] text-slate-500 sm:text-xs">
                    {i % pas === 0 && (
                      <span className="whitespace-nowrap">
                        {s.court}
                        {s.annee && <span className="block text-slate-400">{s.annee}</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Période</th>
                {series.map((s) => (
                  <th key={s.id} className="px-3 py-2 text-right font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.couleur }} aria-hidden />
                      {s.nom}
                    </span>
                  </th>
                ))}
                {series.length > 1 && <th className="px-3 py-2 text-right font-medium">Total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {seaux.map((s, i) => (
                <tr key={s.cle}>
                  <th scope="row" className="px-3 py-1.5 font-normal text-slate-700">
                    <span className="first-letter:capitalize">{s.long}</span>
                  </th>
                  {series.map((serie, j) => (
                    <td key={serie.id} className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {valeurs[i][j] > 0 ? texte(valeurs[i][j]) : <span className="text-slate-300">–</span>}
                    </td>
                  ))}
                  {series.length > 1 && (
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-900">
                      {somme(valeurs[i]) > 0 ? texte(somme(valeurs[i])) : <span className="font-normal text-slate-300">–</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t border-slate-200 bg-slate-50 font-semibold">
              <tr>
                <th scope="row" className="px-3 py-2 text-left">Total</th>
                {series.map((serie, j) => (
                  <td key={serie.id} className="px-3 py-2 text-right tabular-nums">{texte(totalSerie[j])}</td>
                ))}
                {series.length > 1 && <td className="px-3 py-2 text-right tabular-nums">{texte(somme(totalSerie))}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </figure>
  );
}

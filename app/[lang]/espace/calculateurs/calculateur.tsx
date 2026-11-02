"use client";

import { useState } from "react";
import type { Calculateur, Champ, Valeurs } from "../../../dossier/calculateurs/types";

const couleurs = {
  faible: "bg-emerald-50 text-emerald-900",
  moyen: "bg-amber-50 text-amber-900",
  eleve: "bg-orange-50 text-orange-900",
  "tres-eleve": "bg-red-50 text-red-800",
  neutre: "bg-slate-50 text-slate-800",
};

// Interface générique d'un calculateur : cases et choix, résultat immédiat (rien n'est enregistré)
export function CalculateurInteractif({ calculateur }: { calculateur: Calculateur }) {
  const [valeurs, setValeurs] = useState<Valeurs>({});
  const resultat = calculateur.evaluer(valeurs);
  const regler = (cle: string, valeur: boolean | string) => setValeurs((v) => ({ ...v, [cle]: valeur }));

  const groupes = new Map<string, Champ[]>();
  for (const c of calculateur.champs) groupes.set(c.groupe ?? "", [...(groupes.get(c.groupe ?? "") ?? []), c]);

  return (
    <div>
      {[...groupes].map(([groupe, champs]) => (
        <fieldset key={groupe} className="mt-6 first:mt-0">
          {groupe && <legend className="mb-2 text-sm font-semibold text-slate-900">{groupe}</legend>}
          <ul className="space-y-2">
            {champs.map((c) => (
              <li key={c.cle}>
                {c.type === "case" ? (
                  <label className="flex cursor-pointer items-start gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={valeurs[c.cle] === true}
                      onChange={(e) => regler(c.cle, e.target.checked)}
                      className="mt-0.5 accent-red-600"
                    />
                    <span>
                      {c.libelle}
                      {c.aide && <span className="ms-2 text-xs text-slate-400">{c.aide}</span>}
                    </span>
                  </label>
                ) : (
                  <label className="flex flex-wrap items-center gap-2 text-slate-700">
                    {c.libelle}
                    <select
                      value={(valeurs[c.cle] as string | undefined) ?? c.options[0].valeur}
                      onChange={(e) => regler(c.cle, e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                    >
                      {c.options.map((o) => (
                        <option key={o.valeur} value={o.valeur}>
                          {o.libelle}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ul>
        </fieldset>
      ))}

      <div className={`mt-6 rounded-xl p-4 ${couleurs[resultat.gravite]}`} aria-live="polite">
        <p>
          {resultat.score !== null && (
            <>
              Score : <strong className="text-lg">{resultat.score}</strong> ·{" "}
            </>
          )}
          <strong>{resultat.libelle}</strong>
        </p>
        {resultat.recommandation && <p className="mt-2 text-sm">{resultat.recommandation}</p>}
      </div>
    </div>
  );
}

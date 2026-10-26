"use client";

import { useState } from "react";
import { cha2ds2va, criteresCha2ds2va } from "../../../dossier/calculs";

// Calcul du score CHA₂DS₂-VA, pré-rempli avec l'âge et les facteurs de risque du dossier (rien n'est enregistré)
export function CalculCha2ds2va({ preCoches }: { preCoches: string[] }) {
  const [coches, setCoches] = useState(() => new Set(preCoches));
  const score = cha2ds2va(coches);
  const basculer = (cle: string) =>
    setCoches((avant) => {
      const suivant = new Set(avant);
      if (suivant.has(cle)) suivant.delete(cle);
      else {
        suivant.add(cle);
        // Les deux tranches d'âge s'excluent
        if (cle === "age75") suivant.delete("age65");
        if (cle === "age65") suivant.delete("age75");
      }
      return suivant;
    });

  return (
    <div>
      <ul className="space-y-1">
        {criteresCha2ds2va.map((c) => (
          <li key={c.cle}>
            <label className="flex cursor-pointer items-start gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={coches.has(c.cle)}
                onChange={() => basculer(c.cle)}
                className="mt-0.5 accent-red-600"
              />
              <span>
                {c.libelle} <span className="text-slate-400">+{c.points}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-slate-900" aria-live="polite">
        Score : <strong className="text-lg">{score}</strong>
        <span className="ms-2 text-slate-600">
          {score >= 2
            ? "anticoagulation orale recommandée (classe I)"
            : score === 1
              ? "anticoagulation orale à envisager (classe IIa)"
              : "pas d'indication d'anticoagulation sur ce seul score"}
        </span>
      </p>
      <p className="mt-1 text-xs text-slate-500">
        En cas de fibrillation atriale. Recommandations ESC 2024 sur la fibrillation atriale. Ne s&apos;applique pas en
        cas de valve mécanique ou de rétrécissement mitral modéré à serré (AVK dans tous les cas).
      </p>
    </div>
  );
}

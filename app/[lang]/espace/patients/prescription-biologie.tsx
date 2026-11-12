"use client";

import { useActionState, useState } from "react";
import { bilans, catalogue } from "../../../dossier/analyses-biologie";
import type { OptionConsultation } from "../../../dossier/choix-consultation";
import { nouvellePrescriptionBiologie } from "./actions-documents";
import { ChoixConsultation } from "./choix-consultation";
import { BoutonsEnregistrer, ChoixImpression } from "./boutons-document";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

export function FormulairePrescriptionBiologie({
  langue,
  patientId,
  consultations,
  consultationDefaut,
}: {
  langue: string;
  patientId: number;
  consultations: OptionConsultation[];
  consultationDefaut?: number;
}) {
  const [etat, envoyer] = useActionState(nouvellePrescriptionBiologie.bind(null, langue, patientId), null);
  const [cochees, setCochees] = useState<Set<string>>(() => new Set());
  const basculer = (a: string) =>
    setCochees((c) => {
      const n = new Set(c);
      if (n.has(a)) n.delete(a);
      else n.add(a);
      return n;
    });
  const ajouter = (liste: string[]) => setCochees((c) => new Set([...c, ...liste]));

  return (
    <form action={envoyer} className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Bilans habituels (un clic coche plusieurs analyses)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {bilans.map((b) => (
            <button
              key={b.titre}
              type="button"
              onClick={() => ajouter(b.analyses)}
              className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              {b.titre}
            </button>
          ))}
          {cochees.size > 0 && (
            <button
              type="button"
              onClick={() => setCochees(new Set())}
              className="rounded-full px-3 py-1 text-sm text-red-700 hover:bg-red-50"
            >
              Tout décocher
            </button>
          )}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {catalogue.map((g) => (
          <fieldset key={g.titre} className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">{g.titre}</legend>
            <ul className="space-y-1.5">
              {g.analyses.map((a) => (
                <li key={a}>
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      name="analyse"
                      value={a}
                      checked={cochees.has(a)}
                      onChange={() => basculer(a)}
                      className="h-4 w-4 rounded border-slate-300 accent-red-600"
                    />
                    {a}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Autres analyses <span className="font-normal text-slate-400">(texte libre, facultatif)</span>
        <textarea name="remarque" rows={3} maxLength={2000} defaultValue={etat?.valeurs.remarque} className={champ} />
      </label>
      <ChoixConsultation consultations={consultations} defaut={consultationDefaut} className="block" />

      <p className="text-sm text-slate-600" aria-live="polite">
        {cochees.size} analyse{cochees.size > 1 ? "s" : ""} cochée{cochees.size > 1 ? "s" : ""}
      </p>
      <ChoixImpression />
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}
      <BoutonsEnregistrer document="seulement" />
    </form>
  );
}

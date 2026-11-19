"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Bell, Check, ExternalLink, Plus, X } from "lucide-react";
import { ajouter, classer, creneauTraite, preparerPrevenance, type Prevenance } from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

function Ajouter() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
      <Plus className="h-4 w-4" aria-hidden />
      Ajouter à la liste
    </button>
  );
}

export function FormulaireAttente({ langue }: { langue: string }) {
  const [etat, envoyer] = useActionState(ajouter.bind(null, langue), null);
  return (
    <form action={envoyer} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">
        Nom
        <input name="nom" required maxLength={100} defaultValue={etat?.valeurs.nom} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Prénom
        <input name="prenom" maxLength={100} defaultValue={etat?.valeurs.prenom} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Téléphone
        <input name="telephone" type="tel" maxLength={30} defaultValue={etat?.valeurs.telephone} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        E-mail
        <input name="email" type="email" maxLength={100} defaultValue={etat?.valeurs.email} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Souhait (jours, matin ou après-midi, médecin…)
        <input name="souhait" maxLength={300} placeholder="Plutôt le matin, dès que possible" defaultValue={etat?.valeurs.souhait} className={champ} />
      </label>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
          {etat.erreur}
        </p>
      )}
      <div className="sm:col-span-2">
        <Ajouter />
      </div>
    </form>
  );
}

export function BoutonsAttente({ langue, id, prevenu }: { langue: string; id: number; prevenu: boolean }) {
  const [liens, setLiens] = useState<Prevenance | null>(null);
  const [enCours, demarrer] = useTransition();
  const lien = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 underline hover:bg-red-50";
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          disabled={enCours}
          onClick={() => demarrer(async () => setLiens(await preparerPrevenance(langue, id)))}
          className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Bell className="h-3 w-3" aria-hidden />
          {prevenu ? "Prévenir à nouveau" : "Prévenir"}
        </button>
        <button type="button" disabled={enCours} onClick={() => demarrer(() => classer(langue, id, "place"))} className="inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
          <Check className="h-3 w-3" aria-hidden />
          Placé
        </button>
        <button type="button" disabled={enCours} onClick={() => demarrer(() => classer(langue, id, "retire"))} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <X className="h-3 w-3" aria-hidden />
          Retirer
        </button>
      </div>
      {liens && "erreur" in liens && (
        <p role="alert" className="text-xs text-amber-800">
          {liens.erreur}
        </p>
      )}
      {liens && !("erreur" in liens) && (
        <div role="status" className="flex flex-wrap justify-end gap-x-3 text-xs">
          {liens.whatsapp && (
            <a href={liens.whatsapp} target="_blank" rel="noopener noreferrer" className={lien}>
              <ExternalLink className="h-3 w-3" aria-hidden />
              Ouvrir WhatsApp
            </a>
          )}
          {liens.email && (
            <a href={liens.email} className={lien}>
              <ExternalLink className="h-3 w-3" aria-hidden />
              Ouvrir l&apos;e-mail
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function BoutonCreneau({ langue, id }: { langue: string; id: number }) {
  const [enCours, demarrer] = useTransition();
  return (
    <button type="button" disabled={enCours} onClick={() => demarrer(() => creneauTraite(langue, id))} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">
      Pris ou ignoré
    </button>
  );
}

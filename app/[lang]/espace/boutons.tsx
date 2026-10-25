"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { cabinet } from "../../cabinet";
import { ajouter, annuler } from "./actions";

export function BoutonAnnuler({ langue, id, nom }: { langue: string; id: string; nom: string }) {
  return (
    <form action={annuler.bind(null, langue, id)}>
      <Envoyer
        confirmation={`Annuler le rendez-vous de ${nom} ? Il sera supprimé de l'agenda.`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Annuler
      </Envoyer>
    </form>
  );
}

function Envoyer({
  children,
  className,
  confirmation,
}: {
  children: React.ReactNode;
  className: string;
  confirmation?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:opacity-50`}
      onClick={(e) => {
        if (confirmation && !confirm(confirmation)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// Pour les rendez-vous pris par téléphone, WhatsApp ou au cabinet
export function FormulaireAjout({ langue, aujourdhui }: { langue: string; aujourdhui: string }) {
  const [etat, envoyer] = useActionState(ajouter.bind(null, langue), null);
  const v = etat?.valeurs ?? {};

  return (
    <form action={envoyer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-medium text-slate-700">
        Date
        <input name="jour" type="date" required min={aujourdhui} defaultValue={v.jour ?? aujourdhui} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Heure
        <input name="heure" type="time" required step={300} defaultValue={v.heure} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Durée (minutes)
        <input name="duree" type="number" min={5} max={240} step={5} defaultValue={v.duree ?? cabinet.dureeRdv} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Nom du patient
        <input name="nom" required maxLength={100} defaultValue={v.nom} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Téléphone
        <input name="telephone" type="tel" maxLength={30} defaultValue={v.telephone} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Motif
        <input name="motif" maxLength={300} defaultValue={v.motif} className={champ} />
      </label>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2 lg:col-span-3">
          {etat.erreur}
        </p>
      )}
      <div className="sm:col-span-2 lg:col-span-3">
        <Envoyer className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter le rendez-vous
        </Envoyer>
      </div>
    </form>
  );
}

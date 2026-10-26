"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { nouveauMot, retirerMot } from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

function Envoyer({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}

export function FormulaireMot({ langue }: { langue: string }) {
  const [etat, envoyer] = useActionState(nouveauMot.bind(null, langue), null);
  return (
    <form action={envoyer} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-sm font-medium text-slate-700">
        Mot ou expression entendu
        <input
          name="entendu"
          required
          maxLength={100}
          placeholder="bi soprolol"
          defaultValue={etat?.valeurs.entendu}
          className={champ}
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Forme correcte
        <input
          name="correct"
          required
          maxLength={100}
          placeholder="bisoprolol"
          defaultValue={etat?.valeurs.correct}
          className={champ}
        />
      </label>
      <Envoyer className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        <Plus className="h-4 w-4" aria-hidden />
        Ajouter
      </Envoyer>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-3">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}

export function BoutonRetirerMot({ langue, id }: { langue: string; id: number }) {
  return (
    <form action={retirerMot.bind(null, langue, id)}>
      <Envoyer className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50">
        <Trash2 className="h-3 w-3" aria-hidden />
        Retirer
      </Envoyer>
    </form>
  );
}

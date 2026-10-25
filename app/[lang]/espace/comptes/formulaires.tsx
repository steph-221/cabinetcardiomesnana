"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, UserPlus } from "lucide-react";
import { enregistrer, retirer } from "../actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

export function FormulaireCompte({ langue }: { langue: string }) {
  const [etat, envoyer, envoi] = useActionState(enregistrer.bind(null, langue), null);

  return (
    <form action={envoyer} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">
        Identifiant
        <input
          name="identifiant"
          required
          pattern="[a-zA-Z0-9._\-]{2,30}"
          placeholder="secretaire"
          autoCapitalize="none"
          autoComplete="off"
          defaultValue={etat?.valeurs.identifiant}
          className={champ}
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Mot de passe (10 caractères minimum)
        <input name="motDePasse" type="text" required minLength={10} autoComplete="new-password" className={champ} />
      </label>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
          {etat.erreur}
        </p>
      )}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={envoi}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Enregistrer le compte
        </button>
      </div>
    </form>
  );
}

export function BoutonRetirer({ langue, identifiant }: { langue: string; identifiant: string }) {
  return (
    <form action={retirer.bind(null, langue, identifiant)}>
      <Supprimer identifiant={identifiant} />
    </form>
  );
}

function Supprimer({ identifiant }: { identifiant: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(`Supprimer le compte « ${identifiant} » ? La personne n'aura plus accès à l'espace cabinet.`)) {
          e.preventDefault();
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
      Supprimer
    </button>
  );
}

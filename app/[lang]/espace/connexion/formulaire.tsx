"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { connexion } from "../actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

export function FormulaireConnexion({ langue }: { langue: string }) {
  const [etat, envoyer, envoi] = useActionState(connexion.bind(null, langue), null);

  return (
    <form action={envoyer} className="mt-8 space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Identifiant
        <input
          name="identifiant"
          required
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={etat?.valeurs.identifiant}
          className={champ}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Mot de passe
        <input name="motDePasse" type="password" required autoComplete="current-password" className={champ} />
      </label>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}
      <button
        type="submit"
        disabled={envoi}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        <LogIn className="h-5 w-5" aria-hidden />
        {envoi ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

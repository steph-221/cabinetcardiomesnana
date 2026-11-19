"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { verifierMaintenant } from "./actions";

export function BoutonVerifier({ langue }: { langue: string }) {
  const [etat, envoyer, enCours] = useActionState(() => verifierMaintenant(langue), null);
  return (
    <form action={envoyer} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={enCours}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${enCours ? "animate-spin" : ""}`} aria-hidden />
        {enCours ? "Vérification en cours…" : "Vérifier maintenant"}
      </button>
      {etat && (
        <p role="alert" className="text-xs text-red-700">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}

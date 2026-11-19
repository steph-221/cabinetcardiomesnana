"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { repondre, type EtatLien } from "./actions";

function Bouton({ valeur, className, children }: { valeur: string; className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button name="choix" value={valeur} disabled={pending} className={`${className} rounded-full px-6 py-3 font-medium disabled:opacity-50`}>
      {children}
    </button>
  );
}

export function ReponseRendezvous({ id, signature }: { id: string; signature: string }) {
  const [etat, envoyer] = useActionState<EtatLien, FormData>(repondre, null);
  if (etat && etat.statut !== "erreur") {
    return (
      <p role="status" className={`mt-6 rounded-xl p-4 ${etat.statut === "confirme" ? "bg-emerald-50 text-emerald-900" : "bg-slate-100 text-slate-800"}`}>
        {etat.message}
      </p>
    );
  }
  return (
    <form action={envoyer} className="mt-6 space-y-4">
      <input type="hidden" name="r" value={id} />
      <input type="hidden" name="t" value={signature} />
      <div className="flex flex-wrap gap-3">
        <Bouton valeur="confirmer" className="bg-red-600 text-white hover:bg-red-700">
          Je confirme ma venue
        </Bouton>
        <Bouton
          valeur="annuler"
          className="border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          J&apos;annule mon rendez-vous
        </Bouton>
      </div>
      {etat?.statut === "erreur" && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {etat.message}
        </p>
      )}
    </form>
  );
}

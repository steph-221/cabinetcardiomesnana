"use client";

import { useFormStatus } from "react-dom";
import { Printer, Save } from "lucide-react";

// Deux façons d'enregistrer un document : l'impression part tout de suite (bouton principal), ou on enregistre seulement
export function BoutonsEnregistrer({ document: nom }: { document: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        name="imprimer"
        value="1"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Enregistrer et imprimer
      </button>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Save className="h-4 w-4" aria-hidden />
        Enregistrer {nom}
      </button>
    </div>
  );
}

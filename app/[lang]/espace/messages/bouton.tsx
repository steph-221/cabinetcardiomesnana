"use client";

import { useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { traiter } from "./actions";

export function BoutonTraite({ langue, id, traite }: { langue: string; id: number; traite: boolean }) {
  const [enCours, demarrer] = useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => demarrer(() => traiter(langue, id, !traite))}
      className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {traite ? <RotateCcw className="h-3 w-3" aria-hidden /> : <Check className="h-3 w-3" aria-hidden />}
      {traite ? "Rouvrir" : "Marquer traité"}
    </button>
  );
}

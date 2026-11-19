"use client";

import { useState, useTransition } from "react";
import { Bell, ExternalLink } from "lucide-react";
import type { Resultat } from "../../../agenda/notification";
import { preparerRappel } from "./actions";

export function BoutonRappel({ langue, id, deja }: { langue: string; id: string; deja: boolean }) {
  const [resultat, setResultat] = useState<Resultat | { erreur: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const lien = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 underline hover:bg-red-50";
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={enCours}
        onClick={() => demarrer(async () => setResultat(await preparerRappel(langue, id)))}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {deja ? "Renvoyer le rappel" : "Envoyer le rappel"}
      </button>
      {resultat && "erreur" in resultat && (
        <p role="alert" className="text-xs text-amber-800">
          {resultat.erreur}
        </p>
      )}
      {resultat && !("erreur" in resultat) && (
        <div role="status" className="flex flex-wrap justify-end gap-x-3 text-xs text-slate-600">
          {resultat.email.statut === "envoye" && <span>E-mail envoyé à {resultat.email.adresse}</span>}
          {resultat.email.lien && (
            <a href={resultat.email.lien} className={lien}>
              <ExternalLink className="h-3 w-3" aria-hidden />
              Ouvrir l&apos;e-mail
            </a>
          )}
          {resultat.whatsapp.statut === "envoye" && <span>WhatsApp envoyé</span>}
          {resultat.whatsapp.lien && (
            <a href={resultat.whatsapp.lien} target="_blank" rel="noopener noreferrer" className={lien}>
              <ExternalLink className="h-3 w-3" aria-hidden />
              Ouvrir WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}

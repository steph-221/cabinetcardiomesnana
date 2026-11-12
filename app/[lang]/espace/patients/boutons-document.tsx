"use client";

import { useState } from "react";
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

const STOCKAGE = "impression-choix";

function lireChoix(): { format?: string; entete?: string } {
  try {
    const retenu = JSON.parse(globalThis.localStorage?.getItem(STOCKAGE) ?? "{}") as { format?: string; entete?: string };
    return {
      format: retenu.format === "A4" || retenu.format === "A5" ? retenu.format : undefined,
      entete: retenu.entete === "0" || retenu.entete === "1" ? retenu.entete : undefined,
    };
  } catch {
    return {};
  }
}
const selecteur =
  "mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// Papier et en-tête pour l'impression. Le dernier choix est retenu sur cet ordinateur (le papier à en-tête ne change pas).
// Sans en-tête : le haut de la page reste libre pour le papier à en-tête du cabinet.
export function ChoixImpression() {
  // Lecture du stockage local à l'initialisation (le formulaire n'est affiché que dans le navigateur, après chargement)
  const [format, setFormat] = useState(() => lireChoix().format ?? "A5");
  const [entete, setEntete] = useState(() => lireChoix().entete ?? "1");
  const retenir = (f: string, e: string) => {
    try {
      localStorage.setItem(STOCKAGE, JSON.stringify({ format: f, entete: e }));
    } catch {
      // sans importance
    }
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">
        Format de papier
        <select
          name="format"
          suppressHydrationWarning
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            retenir(e.target.value, entete);
          }}
          className={selecteur}
        >
          <option value="A5">A5</option>
          <option value="A4">A4</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        En-tête du cabinet
        <select
          name="entete"
          suppressHydrationWarning
          value={entete}
          onChange={(e) => {
            setEntete(e.target.value);
            retenir(format, e.target.value);
          }}
          className={selecteur}
        >
          <option value="1">Imprimer l&apos;en-tête</option>
          <option value="0">Sans en-tête (papier à en-tête)</option>
        </select>
      </label>
    </div>
  );
}

// Liste des documents : imprimer dans le format voulu, avec ou sans en-tête
export function MenuImpression({ adresse }: { adresse: string }) {
  const formats = ["A5", "A4"] as const;
  const lien = (f: string, e: number) => `${adresse}${adresse.includes("?") ? "&" : "?"}format=${f}&entete=${e}`;
  return (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
        <Printer className="h-3 w-3" aria-hidden />
        Imprimer
      </summary>
      <ul className="absolute end-0 z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg">
        {formats.flatMap((f) => [
          [f, 1, `${f} avec en-tête`],
          [f, 0, `${f} sans en-tête`],
        ] as const).map(([f, e, texte]) => (
          <li key={texte}>
            <a href={lien(f, e)} target="_blank" rel="noopener" className="block px-3 py-1.5 text-slate-700 hover:bg-slate-50">
              {texte}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

"use client";

import { useFormStatus } from "react-dom";
import { ChevronDown, Printer, Save } from "lucide-react";
import {
  adresseImpression,
  impressionParDefaut,
  libelleImpression,
  type OptionsImpression,
} from "../../../dossier/impression";

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

const selecteur =
  "mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// Papier et en-tête pour l'impression. Par défaut : A5 sans en-tête, sur le papier à en-tête du médecin.
// L'en-tête du cabinet est une option, à cocher à chaque fois (il n'est jamais imprimé d'office).
export function ChoixImpression() {
  return (
    <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 sm:items-end">
      <legend className="px-1 text-sm font-medium text-slate-700">Impression</legend>
      <label className="text-sm font-medium text-slate-700">
        Format de papier
        <select name="format" defaultValue={impressionParDefaut.format} className={selecteur}>
          <option value="A5">A5 (papier du médecin)</option>
          <option value="A4">A4</option>
        </select>
      </label>
      <label className="flex items-center gap-2 py-2 text-sm text-slate-700">
        <input type="checkbox" name="entete" value="1" className="h-4 w-4 rounded border-slate-300 accent-red-600" />
        Imprimer l&apos;en-tête du cabinet (papier blanc)
      </label>
    </fieldset>
  );
}

// Les autres façons d'imprimer, proposées dans le menu à côté du bouton principal
const autresChoix: OptionsImpression[] = [
  { format: "A5", entete: true },
  { format: "A4", entete: false },
  { format: "A4", entete: true },
];

// Bouton d'impression d'un document : un clic imprime en A5 sans en-tête (papier à en-tête du médecin) ;
// la flèche propose l'en-tête du cabinet ou l'A4.
export function MenuImpression({
  adresse,
  libelle = "Imprimer",
  className = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100",
}: {
  adresse: string;
  libelle?: string;
  className?: string;
}) {
  return (
    <span className="relative inline-flex items-center">
      <a
        href={adresseImpression(adresse, impressionParDefaut)}
        target="_blank"
        rel="noopener"
        title={`Imprimer en ${libelleImpression(impressionParDefaut)} (papier à en-tête du médecin)`}
        className={className}
      >
        <Printer className="h-3 w-3" aria-hidden />
        {libelle}
      </a>
      <details className="relative">
        <summary
          aria-label={`Autres formats pour : ${libelle}`}
          title="Avec en-tête ou en A4"
          className="inline-flex cursor-pointer list-none items-center rounded-md px-1 py-1 text-xs text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
        >
          <ChevronDown className="h-3 w-3" aria-hidden />
        </summary>
        <ul className="absolute end-0 z-10 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg">
          {autresChoix.map((o) => (
            <li key={libelleImpression(o)}>
              <a
                href={adresseImpression(adresse, o)}
                target="_blank"
                rel="noopener"
                className="block px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                {libelleImpression(o)}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </span>
  );
}

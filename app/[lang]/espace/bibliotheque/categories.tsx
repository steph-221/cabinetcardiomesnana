// Catégories de la bibliothèque : documents importés, sites et revues suivis, médicaments (medicament.ma)

import Link from "next/link";
import { FileText, Globe, Pill } from "lucide-react";

const categories = [
  { cle: "documents", libelle: "Documents", chemin: "", icone: FileText },
  { cle: "sites", libelle: "Sites et revues", chemin: "/sites", icone: Globe },
  { cle: "medicaments", libelle: "Médicaments", chemin: "/medicaments", icone: Pill },
] as const;

export function Categories({ langue, active, alertes = 0 }: { langue: string; active: string; alertes?: number }) {
  return (
    <nav aria-label="Catégories de la bibliothèque" className="mt-4 flex flex-wrap gap-2">
      {categories.map(({ cle, libelle, chemin, icone: Icone }) => (
        <Link
          key={cle}
          href={`/${langue}/espace/bibliotheque${chemin}`}
          aria-current={active === cle ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
            active === cle
              ? "border-red-600 bg-red-600 text-white"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Icone className="h-4 w-4" aria-hidden />
          {libelle}
          {cle === "medicaments" && alertes > 0 && (
            <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-slate-900">{alertes}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

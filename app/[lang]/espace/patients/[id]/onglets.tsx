// Barre des sections du dossier : l'onglet actif est dans l'adresse (?onglet=…), donc partageable et conservé au rechargement

import Link from "next/link";
import { ongletsDisponibles, type CleOnglet } from "../../../../dossier/onglets-patient";

export function NavOnglets({
  base,
  actif,
  medical,
  nombres,
  aPayer,
}: {
  base: string;
  actif: CleOnglet;
  medical: boolean;
  nombres: Partial<Record<CleOnglet, number>>;
  aPayer: boolean;
}) {
  return (
    <nav aria-label="Sections du dossier" className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-slate-200">
        {ongletsDisponibles(medical).map((o) => {
          const courant = o.cle === actif;
          const nombre = nombres[o.cle];
          return (
            <li key={o.cle}>
              <Link
                href={o.cle === "apercu" ? base : `${base}?onglet=${o.cle}`}
                aria-current={courant ? "page" : undefined}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${
                  courant
                    ? "border-red-600 font-semibold text-red-700"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {o.libelle}
                {nombre !== undefined && nombre > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">{nombre}</span>
                )}
                {o.cle === "documents" && aPayer && (
                  <span className="rounded-full bg-red-50 px-2 text-xs font-medium text-red-700">à payer</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

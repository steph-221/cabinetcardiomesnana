// Grille des thèmes cliniques de la bibliothèque : chaque case compte les documents en vigueur et les publications à lire

import Link from "next/link";
import { themes, themesDe } from "../../../dossier/themes";

export function GrilleThemes({
  langue,
  titres,
  aLire,
}: {
  langue: string;
  // Titres des sources en vigueur, et des publications suivies pas encore ajoutées
  titres: string[];
  aLire: string[];
}) {
  const compte = (liste: string[]) => {
    const n = new Map<string, number>();
    for (const t of liste) for (const c of themesDe(t)) n.set(c, (n.get(c) ?? 0) + 1);
    return n;
  };
  const docs = compte(titres);
  const publications = compte(aLire);
  return (
    <section aria-label="Thèmes cliniques" className="mt-6">
      <h2 className="font-semibold text-slate-900">Par thème</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => (
          <li key={t.cle}>
            <Link
              href={`/${langue}/espace/bibliotheque/theme/${t.cle}`}
              className="block rounded-xl border border-slate-200 p-3 text-sm hover:border-red-300 hover:bg-red-50/40"
            >
              <span className="font-medium text-slate-900">{t.libelle}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {docs.get(t.cle) ?? 0} document(s)
                {(publications.get(t.cle) ?? 0) > 0 && ` · ${publications.get(t.cle)} à voir`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

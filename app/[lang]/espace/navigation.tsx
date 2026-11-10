"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, CalendarDays, FolderOpen, Sun } from "lucide-react";
import type { Espace, Page } from "../../dossier/navigation";
import { pageDe } from "../../dossier/navigation";

const icones: Record<string, typeof Sun> = { soleil: Sun, dossier: FolderOpen, agenda: CalendarDays, livre: BookOpen, cabinet: Building2 };

const pastille = (n: number, etiquette: string) =>
  n > 0 && (
    <span title={`${n} ${etiquette}`} className="rounded-full bg-red-600 px-2 text-xs font-semibold text-white group-aria-[current=page]:bg-white group-aria-[current=page]:text-red-700">
      {n}
      <span className="sr-only"> {etiquette}</span>
    </span>
  );

// Barre de l'espace cabinet : cinq espaces, puis les pages de l'espace où l'on se trouve.
// `pastilles` : nombre d'éléments en attente par page (clé de page), affiché sur la page et sur son espace.
export function Navigation({
  langue,
  espaces,
  secretaire,
  pastilles,
  fin,
}: {
  langue: string;
  espaces: Espace[];
  secretaire: boolean;
  pastilles: Record<string, number>;
  fin: React.ReactNode;
}) {
  const chemin = usePathname();
  const actif = pageDe(chemin);
  const base = `/${langue}/espace`;
  const lien = (p: Page) => `${base}${secretaire && p.cheminSecretaire ? p.cheminSecretaire : p.chemin}`;
  const courant = espaces.find((e) => e.cle === actif?.espace.cle);
  const sous = useRef<HTMLAnchorElement>(null);
  useEffect(() => sous.current?.scrollIntoView({ block: "nearest", inline: "nearest" }), [chemin]);

  const classe = (actifOui: boolean) =>
    `group inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
      actifOui ? "border-red-600 bg-red-600 font-medium text-white hover:bg-red-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <div className="sticky top-16 z-40 border-b border-slate-200 bg-white/90 backdrop-blur" lang="fr" dir="ltr">
      <nav aria-label="Espaces du cabinet" className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
        {espaces.map((e) => {
          const Icone = icones[e.icone] ?? Sun;
          const n = e.pages.reduce((somme, p) => somme + (pastilles[p.cle] ?? 0), 0);
          const estActif = e.cle === actif?.espace.cle;
          return (
            <Link key={e.cle} href={lien(e.pages[0])} aria-current={estActif ? "page" : undefined} className={classe(estActif)}>
              <Icone className="h-4 w-4" aria-hidden />
              {e.libelle}
              {pastille(n, "en attente")}
            </Link>
          );
        })}
        <div className="ms-auto shrink-0">{fin}</div>
      </nav>
      {courant && courant.pages.length > 1 && (
        <nav aria-label={`Pages : ${courant.libelle}`} className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {courant.pages.map((p) => {
            const estActive = p.cle === actif?.page.cle;
            return (
              <Link
                key={p.cle}
                ref={estActive ? sous : undefined}
                href={lien(p)}
                aria-current={estActive ? "page" : undefined}
                className={`group inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1 text-sm ${
                  estActive ? "bg-slate-900 font-medium text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p.libelle}
                {pastille(pastilles[p.cle] ?? 0, "en attente")}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Globe, HeartPulse, Menu, Phone, X } from "lucide-react";
import { cabinet, langues, nomsLangues, type Langue } from "../cabinet";
import type { Dictionnaire } from "./dictionaries";

function SelecteurLangue({ langue, label }: { langue: Langue; label: string }) {
  const chemin = usePathname();
  // Remplace le premier segment (/fr, /ar…) en gardant le reste du chemin
  const versLangue = (l: Langue) => chemin.replace(/^\/[^/]+/, `/${l}`);

  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Globe className="h-4 w-4 text-slate-400" aria-hidden />
      {langues.map((l) => (
        <Link
          key={l}
          href={versLangue(l)}
          hrefLang={l}
          lang={l}
          aria-current={l === langue ? "true" : undefined}
          className={`rounded px-1.5 py-0.5 text-sm ${
            l === langue ? "bg-red-50 font-semibold text-red-700" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {l === "ar" ? nomsLangues.ar : l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

export function Header({ langue, t }: { langue: Langue; t: Dictionnaire }) {
  const [ouvert, setOuvert] = useState(false);
  const fixe = cabinet.telephones.fixe;
  const liens = [
    { href: `/${langue}#soins`, label: t.nav.soins },
    { href: `/${langue}#medecin`, label: t.nav.medecin },
    { href: `/${langue}#cabinet`, label: t.nav.cabinet },
    { href: `/${langue}#infos`, label: t.nav.infos },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={`/${langue}`} className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
          <HeartPulse className="h-7 w-7 text-red-600" aria-hidden />
          <span>{t.nomCourt}</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label={t.nom}>
          {liens.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-slate-600 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <SelecteurLangue langue={langue} label={t.nav.langue} />
          <a
            href={`tel:${fixe.lien}`}
            className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Phone className="h-4 w-4" aria-hidden />
            <span dir="ltr">{fixe.numero}</span>
          </a>
          <Link
            href={`/${langue}/rendez-vous`}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            {t.nav.rdv}
          </Link>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-slate-700 lg:hidden"
          aria-label={ouvert ? t.nav.fermerMenu : t.nav.ouvrirMenu}
          aria-expanded={ouvert}
          onClick={() => setOuvert(!ouvert)}
        >
          {ouvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {ouvert && (
        <nav className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden" aria-label={t.nom}>
          <ul className="flex flex-col gap-3">
            {liens.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOuvert(false)} className="block py-1 text-slate-700">
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <SelecteurLangue langue={langue} label={t.nav.langue} />
            </li>
            <li className="flex flex-wrap gap-2 pt-2">
              <Link
                href={`/${langue}/rendez-vous`}
                onClick={() => setOuvert(false)}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                <CalendarCheck className="h-4 w-4" aria-hidden />
                {t.nav.rdv}
              </Link>
              <a
                href={`tel:${fixe.lien}`}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
              >
                <Phone className="h-4 w-4" aria-hidden />
                {t.nav.appeler}
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

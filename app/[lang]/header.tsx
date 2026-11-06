"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Globe, HeartPulse, Menu, Phone, X } from "lucide-react";
import { cabinet, langues, nomsLangues, type Langue } from "../cabinet";
import type { Dictionnaire } from "./dictionaries";

// Sur les pages dont l'adresse n'est connue qu'à la requête (dossier patient…), les liens mènent d'abord à
// l'accueil de chaque langue, le temps de lire l'adresse
function SelecteurLangue({ langue, label }: { langue: Langue; label: string }) {
  return (
    <Suspense fallback={<Langues langue={langue} label={label} versLangue={(l) => `/${l}`} />}>
      <SelecteurLangueChemin langue={langue} label={label} />
    </Suspense>
  );
}

function SelecteurLangueChemin({ langue, label }: { langue: Langue; label: string }) {
  const chemin = usePathname();
  // Remplace le premier segment (/fr, /ar…) en gardant le reste du chemin
  return <Langues langue={langue} label={label} versLangue={(l) => chemin.replace(/^\/[^/]+/, `/${l}`)} />;
}

function Langues({
  langue,
  label,
  versLangue,
}: {
  langue: Langue;
  label: string;
  versLangue: (l: Langue) => string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Globe className="h-4 w-4 text-gris" aria-hidden />
      {langues.map((l) => (
        <Link
          key={l}
          href={versLangue(l)}
          hrefLang={l}
          lang={l}
          aria-current={l === langue ? "true" : undefined}
          className={`rounded-full px-2 py-0.5 text-xs ${
            l === langue ? "bg-brume font-semibold text-encre" : "text-gris hover:text-encre"
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
    <header className="sticky top-0 z-50 verre border-b border-black/10">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={`/${langue}`} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-encre">
          <HeartPulse className="h-5 w-5 text-accent" aria-hidden />
          <span>{t.nomCourt}</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label={t.nom}>
          {liens.map((l) => (
            <Link key={l.href} href={l.href} className="text-xs text-encre/80 transition-colors hover:text-encre">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <SelecteurLangue langue={langue} label={t.nav.langue} />
          <a
            href={`tel:${fixe.lien}`}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-accent hover:bg-brume"
          >
            <Phone className="h-4 w-4" aria-hidden />
            <span dir="ltr">{fixe.numero}</span>
          </a>
          <Link
            href={`/${langue}/rendez-vous`}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-fonce"
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            {t.nav.rdv}
          </Link>
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-encre lg:hidden"
          aria-label={ouvert ? t.nav.fermerMenu : t.nav.ouvrirMenu}
          aria-expanded={ouvert}
          onClick={() => setOuvert(!ouvert)}
        >
          {ouvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {ouvert && (
        <nav className="verre border-t border-black/10 px-4 py-4 lg:hidden" aria-label={t.nom}>
          <ul className="flex flex-col gap-3">
            {liens.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOuvert(false)} className="block py-1.5 text-lg font-medium text-encre">
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
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                <CalendarCheck className="h-4 w-4" aria-hidden />
                {t.nav.rdv}
              </Link>
              <a
                href={`tel:${fixe.lien}`}
                className="inline-flex items-center gap-2 rounded-full bg-brume px-4 py-2 text-sm font-medium text-accent"
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

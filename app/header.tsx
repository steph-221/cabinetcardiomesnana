"use client";

import { useState } from "react";
import Link from "next/link";
import { HeartPulse, Menu, Phone, X } from "lucide-react";
import { cabinet, telephonePrincipal } from "./cabinet";

const liens = [
  { href: "/#soins", label: "Soins & examens" },
  { href: "/#medecin", label: "Le médecin" },
  { href: "/#cabinet", label: "Le cabinet" },
  { href: "/#infos", label: "Infos pratiques" },
];

export function Header() {
  const [ouvert, setOuvert] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <HeartPulse className="h-7 w-7 text-red-600" aria-hidden />
          <span>{cabinet.nomCourt}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Navigation principale">
          {liens.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-slate-600 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
          <a
            href={`tel:${telephonePrincipal.lien}`}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Phone className="h-4 w-4" aria-hidden />
            {telephonePrincipal.numero}
          </a>
        </nav>

        <button
          type="button"
          className="rounded-md p-2 text-slate-700 md:hidden"
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={ouvert}
          onClick={() => setOuvert(!ouvert)}
        >
          {ouvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {ouvert && (
        <nav className="border-t border-slate-200 bg-white px-4 py-4 md:hidden" aria-label="Navigation mobile">
          <ul className="flex flex-col gap-3">
            {liens.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOuvert(false)} className="block py-1 text-slate-700">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={`tel:${telephonePrincipal.lien}`}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                <Phone className="h-4 w-4" aria-hidden />
                Appeler le cabinet
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

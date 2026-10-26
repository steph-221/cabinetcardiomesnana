"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Onglet de la barre de l'espace cabinet : en rouge sur la page (ou la sous-page) qu'il ouvre
export function Onglet({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const chemin = usePathname();
  const actif = chemin === href || (!exact && chemin.startsWith(`${href}/`));
  const lien = useRef<HTMLAnchorElement>(null);
  // Sur téléphone, la barre défile : garde l'onglet actif visible
  useEffect(() => {
    if (actif) lien.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [actif]);
  return (
    <Link
      ref={lien}
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`group inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
        actif
          ? "border-red-600 bg-red-600 font-medium text-white hover:bg-red-700"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}

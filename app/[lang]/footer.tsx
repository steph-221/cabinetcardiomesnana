import Link from "next/link";
import { cabinet, type Langue } from "../cabinet";
import type { Dictionnaire } from "./dictionaries";

export function Footer({ langue, t }: { langue: Langue; t: Dictionnaire }) {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {t.nom} — {cabinet.medecin}
        </p>
        <Link href={`/${langue}/mentions-legales`} className="hover:text-slate-900">
          {t.pied.mentions}
        </Link>
      </div>
    </footer>
  );
}

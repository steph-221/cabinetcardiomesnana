import Link from "next/link";
import { cabinet } from "./cabinet";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {cabinet.nom} — {cabinet.medecin.nom}
        </p>
        <Link href="/mentions-legales" className="hover:text-slate-900">
          Mentions légales
        </Link>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function Retour({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  );
}

export function BaseNonConfiguree() {
  return (
    <p role="alert" className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
      La base des dossiers patients n&apos;est pas encore activée. Sur Vercel : Storage → Create Database → Neon
      (Postgres), reliez-la au projet puis redéployez (voir DOSSIER.md).
    </p>
  );
}

export function ErreurLecture() {
  return (
    <p role="alert" className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-800">
      Impossible de lire les dossiers pour le moment. Réessayez dans un instant.
    </p>
  );
}

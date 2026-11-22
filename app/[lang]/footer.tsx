import Link from "next/link";
import { cabinet, type Langue } from "../cabinet";
import type { Dictionnaire } from "./dictionaries";

export function Footer({ langue, t }: { langue: Langue; t: Dictionnaire }) {
  return (
    <footer className="mt-auto bg-brume">
      <div className="mx-auto flex max-w-6xl border-t border-filet/60 flex-col gap-2 px-4 py-8 text-xs text-gris sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {t.nom} — {cabinet.medecin}
        </p>
        <div className="flex gap-4">
          <Link href={`/${langue}/mentions-legales`} className="hover:text-encre">
            {t.pied.mentions}
          </Link>
          <Link href={`/${langue}/espace`} className="text-gris/70 hover:text-encre" lang="fr">
            Espace cabinet
          </Link>
        </div>
      </div>
    </footer>
  );
}

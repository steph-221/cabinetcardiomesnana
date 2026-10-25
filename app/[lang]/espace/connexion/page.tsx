import type { Metadata } from "next";
import { estLangue } from "../../../cabinet";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = {
  title: "Espace cabinet",
  robots: { index: false, follow: false },
};

export default async function Connexion({ params }: PageProps<"/[lang]/espace/connexion">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:px-6" lang="fr" dir="ltr">
      <h1 className="text-2xl font-bold text-slate-900">Espace cabinet</h1>
      <p className="mt-2 text-sm text-slate-600">
        Réservé au médecin, au médecin remplaçant et au secrétariat.
      </p>
      <FormulaireConnexion langue={lang} />
    </div>
  );
}

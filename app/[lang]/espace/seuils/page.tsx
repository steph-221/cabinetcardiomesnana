import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ShieldCheck } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { seuils } from "../../../dossier/comptes-rendus/seuils";
import { claudeConfigure } from "../../../dossier/dictee";
import { lireReferences } from "../../../dossier/verification-seuils";
import { BaseNonConfiguree } from "../patients/commun";
import { VerificationSeuils } from "./verification";

export const metadata: Metadata = {
  title: "Vérification des seuils",
  robots: { index: false, follow: false },
};

export default async function PageSeuils({ params }: PageProps<"/[lang]/espace/seuils">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

async function Contenu({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const references = await lireReferences().catch(() => ({}));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <ShieldCheck className="h-6 w-6 text-red-600" aria-hidden />
          Vérification des seuils cliniques
        </h1>
        <Link
          href={`/${langue}/espace/bibliotheque`}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Bibliothèque
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Les comptes rendus appliquent {seuils.length} règles (seuils, classifications). Pour chacune, l&apos;assistant cherche
        dans la bibliothèque le passage qui la confirme ou la contredit et recopie la phrase concernée. Ce n&apos;est qu&apos;une
        aide : <strong>vous lisez le passage, puis vous validez ou demandez une correction</strong>. Rien n&apos;est considéré
        comme vérifié sans votre validation, et chaque proposition d&apos;un compte rendu renvoie à son passage et au document
        à la bonne page.
      </p>
      <VerificationSeuils
        langue={langue}
        seuils={seuils}
        initiales={references}
        claude={claudeConfigure()}
      />
    </>
  );
}

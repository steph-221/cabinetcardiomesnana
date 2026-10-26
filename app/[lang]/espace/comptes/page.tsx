import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ShieldCheck, UserRound } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { listerComptes, utilisateurConnecte } from "../../../agenda/session";
import { stockageConfigure } from "../../../agenda/stockage";
import { BoutonRetirer, ChoixRole, FormulaireCompte } from "./formulaires";

export const metadata: Metadata = {
  title: "Comptes du personnel",
  robots: { index: false, follow: false },
};

export default async function Comptes({ params }: PageProps<"/[lang]/espace/comptes">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="text-2xl font-bold text-slate-900">Comptes du personnel</h1>
      <p className="mt-1 text-sm text-slate-500">
        Créez un compte pour la secrétaire, un médecin remplaçant… Supprimez-le à la fin du remplacement : l&apos;accès
        est coupé immédiatement. Le rôle « secrétaire » ne donne pas accès au contenu médical des dossiers.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} />
      </Suspense>
    </div>
  );
}

async function Liste({ langue }: { langue: string }) {
  await connection();
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect(`/${langue}/espace/connexion`);
  if (!utilisateur.admin) redirect(`/${langue}/espace`);

  if (!stockageConfigure()) {
    return (
      <p role="alert" className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Le stockage des comptes n&apos;est pas encore activé. Sur Vercel : Storage → Create Database → Upstash
        (Redis), reliez-le au projet puis redéployez (voir RESERVATION.md).
      </p>
    );
  }

  let comptes: Awaited<ReturnType<typeof listerComptes>> | null = null;
  try {
    comptes = await listerComptes();
  } catch (erreur) {
    console.error(erreur);
  }
  const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso));

  return (
    <>
      <ul className="mt-8 divide-y divide-slate-100 rounded-xl border border-slate-200">
        <li className="flex items-center gap-3 p-4 text-sm">
          <ShieldCheck className="h-5 w-5 text-red-600" aria-hidden />
          <span className="font-medium text-slate-900">{utilisateur.identifiant}</span>
          <span className="text-slate-500">administrateur (défini sur Vercel)</span>
        </li>
        {comptes === null ? (
          <li className="p-4 text-sm text-red-800">Impossible de lire les comptes. Réessayez dans un instant.</li>
        ) : (
          comptes.map((c) => (
            <li key={c.identifiant} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-slate-400" aria-hidden />
                <span className="font-medium text-slate-900">{c.identifiant}</span>
                <span className="text-slate-500">depuis le {date(c.creeLe)}</span>
              </div>
              <div className="flex items-center gap-2">
                <ChoixRole langue={langue} identifiant={c.identifiant} role={c.role} />
                <BoutonRetirer langue={langue} identifiant={c.identifiant} />
              </div>
            </li>
          ))
        )}
      </ul>

      <section className="mt-8 rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Ajouter un compte ou changer un mot de passe</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pour un compte existant, saisissez son identifiant et un nouveau mot de passe : l&apos;ancien ne fonctionnera
          plus.
        </p>
        <FormulaireCompte langue={langue} />
      </section>
    </>
  );
}

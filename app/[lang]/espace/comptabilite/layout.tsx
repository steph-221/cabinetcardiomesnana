import { Suspense } from "react";
import { connection } from "next/server";
import { ChartColumn, Landmark, LayoutDashboard, Receipt, Settings, ShoppingCart } from "lucide-react";
import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { Onglet } from "../onglet";

// Sous-menu de la comptabilité. La secrétaire n'a que les factures (facturer, encaisser) ;
// le tableau de bord, les statistiques, les charges et les réglages sont réservés aux médecins.
export default async function LayoutComptabilite({ children, params }: LayoutProps<"/[lang]/espace/comptabilite">) {
  const { lang } = await params;
  return (
    <>
      <Suspense fallback={null}>
        <SousMenu langue={lang} />
      </Suspense>
      {children}
    </>
  );
}

async function SousMenu({ langue }: { langue: string }) {
  await connection();
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return null;
  const base = `/${langue}/espace/comptabilite`;
  return (
    <div className="border-b border-slate-100 bg-slate-50" lang="fr" dir="ltr">
      <nav aria-label="Comptabilité" className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
        <Landmark className="me-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {accesMedical(utilisateur) && (
          <Onglet href={base} exact>
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Tableau de bord
          </Onglet>
        )}
        <Onglet href={`${base}/factures`}>
          <Receipt className="h-4 w-4" aria-hidden />
          Factures
        </Onglet>
        {accesMedical(utilisateur) && (
          <Onglet href={`${base}/statistiques`}>
            <ChartColumn className="h-4 w-4" aria-hidden />
            Statistiques
          </Onglet>
        )}
        {accesMedical(utilisateur) && (
          <Onglet href={`${base}/charges`}>
            <ShoppingCart className="h-4 w-4" aria-hidden />
            Charges
          </Onglet>
        )}
        {accesMedical(utilisateur) && (
          <Onglet href={`${base}/reglages`}>
            <Settings className="h-4 w-4" aria-hidden />
            Réglages
          </Onglet>
        )}
      </nav>
    </div>
  );
}

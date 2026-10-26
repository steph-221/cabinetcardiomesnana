import { Suspense } from "react";
import { connection } from "next/server";
import {
  BookA,
  CalendarClock,
  CalendarDays,
  FileInput,
  FolderOpen,
  HardDrive,
  History,
  Library,
  LogOut,
  MessagesSquare,
  Users,
} from "lucide-react";
import { jourLocal } from "../../agenda/creneaux";
import { accesMedical, utilisateurConnecte } from "../../agenda/session";
import { baseConfiguree } from "../../dossier/base";
import { compterEnRetard } from "../../dossier/suivis";
import { deconnexion } from "./actions";
import { Onglet } from "./onglet";

// Les onglets restent en haut de chaque page de l'espace, pour passer d'une rubrique à l'autre
export default async function LayoutEspace({ children, params }: LayoutProps<"/[lang]/espace">) {
  const { lang } = await params;
  return (
    <>
      <Suspense fallback={null}>
        <Onglets langue={lang} />
      </Suspense>
      {children}
    </>
  );
}

async function Onglets({ langue }: { langue: string }) {
  await connection();
  // Pas d'onglets sur la page de connexion
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return null;

  let enRetard = 0;
  if (baseConfiguree()) {
    try {
      enRetard = await compterEnRetard(jourLocal(new Date()));
    } catch (erreur) {
      console.error(erreur);
    }
  }

  const base = `/${langue}/espace`;
  return (
    <div className="sticky top-16 z-40 border-b border-slate-200 bg-white/90 backdrop-blur" lang="fr" dir="ltr">
      <nav aria-label="Espace cabinet" className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
        <Onglet href={base} exact>
          <CalendarDays className="h-4 w-4" aria-hidden />
          Agenda
        </Onglet>
        <Onglet href={`${base}/patients`}>
          <FolderOpen className="h-4 w-4" aria-hidden />
          Patients
        </Onglet>
        <Onglet href={`${base}/suivis`}>
          <CalendarClock className="h-4 w-4" aria-hidden />
          Suivis
          {enRetard > 0 && (
            <span
              title={`${enRetard} en retard`}
              className="rounded-full bg-red-600 px-2 text-xs font-semibold text-white group-aria-[current=page]:bg-white group-aria-[current=page]:text-red-700"
            >
              {enRetard}
              <span className="sr-only"> en retard</span>
            </span>
          )}
        </Onglet>
        {accesMedical(utilisateur) && (
          <Onglet href={`${base}/lexique`}>
            <BookA className="h-4 w-4" aria-hidden />
            Lexique
          </Onglet>
        )}
        {accesMedical(utilisateur) && (
          <Onglet href={`${base}/assistant`}>
            <MessagesSquare className="h-4 w-4" aria-hidden />
            Assistant
          </Onglet>
        )}
        {accesMedical(utilisateur) && (
          <Onglet href={`${base}/bibliotheque`}>
            <Library className="h-4 w-4" aria-hidden />
            Bibliothèque
          </Onglet>
        )}
        {accesMedical(utilisateur) && (
          <Onglet href={`${base}/reprise`}>
            <FileInput className="h-4 w-4" aria-hidden />
            Reprise Word
          </Onglet>
        )}
        {utilisateur.admin && (
          <Onglet href={`${base}/drive`}>
            <HardDrive className="h-4 w-4" aria-hidden />
            Drive
          </Onglet>
        )}
        {utilisateur.admin && (
          <Onglet href={`${base}/journal`}>
            <History className="h-4 w-4" aria-hidden />
            Journal
          </Onglet>
        )}
        {utilisateur.admin && (
          <Onglet href={`${base}/comptes`}>
            <Users className="h-4 w-4" aria-hidden />
            Comptes
          </Onglet>
        )}
        <form action={deconnexion.bind(null, langue)} className="ms-auto shrink-0">
          <button
            type="submit"
            title={`Se déconnecter (${utilisateur.identifiant})`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Se déconnecter
          </button>
        </form>
      </nav>
    </div>
  );
}

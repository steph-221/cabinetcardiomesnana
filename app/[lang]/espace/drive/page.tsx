import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { CheckCircle2, HardDrive } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { compteDrive, driveConfigure } from "../../../dossier/drive";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";
import { BoutonDeconnexion } from "./bouton";

export const metadata: Metadata = {
  title: "Google Drive",
  robots: { index: false, follow: false },
};

const messages: Record<string, { texte: string; ok: boolean }> = {
  connecte: { texte: "Google Drive est connecté.", ok: true },
  annule: { texte: "Connexion annulée.", ok: false },
  refuse: { texte: "La connexion a expiré ou n'a pas pu être vérifiée. Recommencez.", ok: false },
  erreur: { texte: "Google n'a pas accepté la connexion. Recommencez dans un instant.", ok: false },
  portee: {
    texte:
      "L'accès à Google Drive n'a pas été autorisé : recommencez et, sur la page de Google, cochez la case d'accès aux fichiers Google Drive.",
    ok: false,
  },
};

export default async function Drive({ params, searchParams }: PageProps<"/[lang]/espace/drive">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <HardDrive className="h-6 w-6 text-red-600" aria-hidden />
        Google Drive
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Les examens (PDF, photos) sont rangés dans le Google Drive du cabinet, dans un dossier « Cabinet — Dossiers
        patients », avec un sous-dossier par patient. Le site n&apos;a accès qu&apos;aux fichiers qu&apos;il a lui-même
        créés.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Etat langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Etat({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/drive">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "admin");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  if (!driveConfigure()) {
    return (
      <p role="alert" className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Les identifiants OAuth Google ne sont pas encore renseignés sur Vercel (GOOGLE_OAUTH_CLIENT_ID et
        GOOGLE_OAUTH_CLIENT_SECRET). Voir DOSSIER.md.
      </p>
    );
  }

  let compte: Awaited<ReturnType<typeof compteDrive>> = null;
  try {
    compte = await compteDrive();
  } catch (erreur) {
    console.error(erreur);
    return <ErreurLecture />;
  }
  const message = messages[String((await searchParams).resultat ?? "")];
  const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso));

  return (
    <>
      {message && (
        <p
          role="status"
          className={`mt-6 rounded-lg p-4 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
        >
          {message.texte}
        </p>
      )}
      <section className="mt-6 rounded-2xl border border-slate-200 p-6 text-sm">
        {compte ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-slate-900">
              <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
              Connecté au compte <strong>{compte.email || "Google"}</strong> depuis le {date(compte.connecteLe)}
            </p>
            <BoutonDeconnexion langue={langue} />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-700">
              Connectez le compte Google du cabinet : Google vous demandera d&apos;autoriser le site à créer et lire
              ses propres fichiers dans votre Drive.
            </p>
            {/* Navigation complète : la route redirige vers la page de consentement de Google */}
            <form action="/api/drive/connexion" method="get">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <HardDrive className="h-4 w-4" aria-hidden />
                Connecter Google Drive
              </button>
            </form>
          </div>
        )}
      </section>
    </>
  );
}

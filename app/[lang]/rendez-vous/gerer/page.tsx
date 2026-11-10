import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Phone } from "lucide-react";
import { cabinet, estLangue } from "../../../cabinet";
import { lireRendezvous } from "../../../agenda/google";
import { signatureValide } from "../../../agenda/lien-patient";
import { quand } from "../../../agenda/notification";
import { ReponseRendezvous } from "./formulaire";

export const metadata: Metadata = {
  title: "Votre rendez-vous",
  robots: { index: false, follow: false },
};

export default async function Gerer({ params, searchParams }: PageProps<"/[lang]/rendez-vous/gerer">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="text-2xl font-bold text-slate-900">Votre rendez-vous</h1>
      <Suspense fallback={<p className="mt-6 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Le rendez-vous est-il déjà passé ? (hors du rendu : dépend de l'heure)
const estPasse = (d: Date) => d.getTime() < Date.now();

function Appel({ texte }: { texte: string }) {
  return (
    <div className="mt-6 rounded-xl border border-slate-200 p-4">
      <p className="text-slate-700">{texte}</p>
      <a
        href={`tel:${cabinet.telephones.fixe.lien}`}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 font-medium text-white hover:bg-red-700"
      >
        <Phone className="h-4 w-4" aria-hidden />
        <span dir="ltr">{cabinet.telephones.fixe.numero}</span>
      </a>
    </div>
  );
}

async function Contenu({ langue, searchParams }: { langue: string; searchParams: PageProps<"/[lang]/rendez-vous/gerer">["searchParams"] }) {
  await connection();
  const q = await searchParams;
  const id = typeof q.r === "string" ? q.r : "";
  const signature = typeof q.t === "string" ? q.t : "";
  if (!signatureValide(id, signature)) return <Appel texte="Ce lien n'est pas valide. Pour confirmer ou annuler votre rendez-vous, appelez le cabinet." />;

  let rdv;
  try {
    rdv = await lireRendezvous(id);
  } catch {
    return <Appel texte="Ce rendez-vous n'existe plus. Pour en prendre un nouveau, appelez le cabinet ou réservez en ligne." />;
  }
  if (!rdv.annulable || rdv.fermeture || rdv.debut.length === 10) return <Appel texte="Ce rendez-vous ne peut pas être modifié en ligne." />;
  const debut = new Date(rdv.debut);
  if (estPasse(debut)) return <Appel texte="Ce rendez-vous est déjà passé." />;

  return (
    <>
      <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-800">
        <span className="font-semibold first-letter:capitalize">{quand(debut)}</span>
        {rdv.medecin && <span className="block text-sm text-slate-600">Dr {rdv.medecin}</span>}
        <span className="block text-sm text-slate-600">
          {cabinet.adresse.rue}, {cabinet.adresse.ville}
        </span>
      </p>
      {rdv.confirme ? (
        <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Vous avez déjà confirmé ce rendez-vous. Vous pouvez encore l&apos;annuler.
        </p>
      ) : null}
      <ReponseRendezvous id={id} signature={signature} />
      <p className="mt-6 text-sm text-slate-500">
        Pour changer d&apos;horaire, annulez puis{" "}
        <Link href={`/${langue}/rendez-vous`} className="text-red-700 underline">
          choisissez un autre créneau
        </Link>
        , ou appelez le {cabinet.telephones.fixe.numero}.
      </p>
    </>
  );
}

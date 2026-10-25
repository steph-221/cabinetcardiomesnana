import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Phone, TriangleAlert } from "lucide-react";
import { cabinet, estLangue, type Langue } from "../../cabinet";
import { joursReservables } from "../../agenda/creneaux";
import { agendaConfigure } from "../../agenda/google";
import { getDictionnaire, type Dictionnaire } from "../dictionaries";
import { Reservation } from "./reservation";

export async function generateMetadata({ params }: PageProps<"/[lang]/rendez-vous">): Promise<Metadata> {
  const { lang } = await params;
  return estLangue(lang) ? { title: getDictionnaire(lang).reservation.titre } : {};
}

export default async function PageRendezvous({ params }: PageProps<"/[lang]/rendez-vous">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  const t = getDictionnaire(lang);
  const r = t.reservation;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">{r.titre}</h1>
      <p className="mt-2 text-slate-600">{r.intro}</p>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          <strong>{t.urgence.titre}</strong> {t.urgence.texte}
        </p>
      </div>

      <Suspense fallback={<p className="mt-10 text-slate-500">{r.chargement}</p>}>
        <Formulaire langue={lang} t={t} />
      </Suspense>
    </div>
  );
}

async function Formulaire({ langue, t }: { langue: Langue; t: Dictionnaire }) {
  // Les jours proposés dépendent de la date du jour : calcul à chaque visite
  await connection();
  if (!agendaConfigure()) {
    return (
      <div className="mt-10 rounded-2xl border border-slate-200 p-6">
        <p className="text-slate-700">{t.reservation.indisponible}</p>
        <a
          href={`tel:${cabinet.telephones.fixe.lien}`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700"
        >
          <Phone className="h-5 w-5" aria-hidden />
          <span dir="ltr">{cabinet.telephones.fixe.numero}</span>
        </a>
      </div>
    );
  }
  return <Reservation langue={langue} t={t.reservation} jours={joursReservables()} />;
}

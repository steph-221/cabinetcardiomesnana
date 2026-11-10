import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { FolderOpen, MessageCircle, OctagonAlert } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { assistantActive } from "../../../agenda/whatsapp";
import { baseConfiguree } from "../../../dossier/base";
import { listerMessages, type MessageWhatsApp } from "../../../dossier/messages-whatsapp";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";
import { BoutonTraite } from "./bouton";

export const metadata: Metadata = {
  title: "Messages WhatsApp",
  robots: { index: false, follow: false },
};

export default async function Messages({ params }: PageProps<"/[lang]/espace/messages">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <MessageCircle className="h-6 w-6 text-red-600" aria-hidden />
        Messages WhatsApp
      </h1>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} />
      </Suspense>
    </div>
  );
}

const quand = (d: Date) => d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });

async function Liste({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let messages: MessageWhatsApp[];
  try {
    messages = await listerMessages();
  } catch (erreur) {
    console.error(erreur);
    return <ErreurLecture />;
  }
  const ouverts = messages.filter((m) => !m.traiteLe);
  return (
    <>
      <p className="mt-1 text-sm text-slate-500">
        {assistantActive()
          ? "L'assistant répond seul aux questions pratiques (horaires, adresse, rendez-vous) et renvoie vers le 141 / le 15 pour une urgence possible. Il ne donne jamais d'avis médical : le reste attend ici."
          : "Réponses automatiques non activées : les messages reçus sont seulement rangés ici (voir RESERVATION.md)."}
      </p>
      {ouverts.some((m) => m.urgent) && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          <OctagonAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          Un message évoque une urgence possible : à lire et à traiter en premier, par téléphone de préférence.
        </p>
      )}
      {messages.length === 0 ? (
        <p className="mt-6 text-slate-500">Aucun message.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={`rounded-2xl border p-4 text-sm ${m.traiteLe ? "border-slate-100 opacity-60" : m.urgent ? "border-red-300 bg-red-50/50" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {m.nom || "Numéro inconnu"} <span className="font-normal text-slate-500">· +{m.numero}</span>
                    {m.urgent && <span className="ms-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">Urgence possible</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {quand(m.recuLe)}
                    {m.traiteLe && ` · traité par ${m.traitePar}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.patientId && (
                    <Link href={`/${langue}/espace/patients/${m.patientId}`} className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-red-700">
                      <FolderOpen className="h-3 w-3" aria-hidden />
                      Dossier
                    </Link>
                  )}
                  <a href={`https://wa.me/${m.numero}`} target="_blank" rel="noopener noreferrer" className="text-xs text-red-700 underline">
                    Répondre sur WhatsApp
                  </a>
                  <a href={`tel:+${m.numero}`} className="text-xs text-red-700 underline">
                    Appeler
                  </a>
                  <BoutonTraite langue={langue} id={m.id} traite={Boolean(m.traiteLe)} />
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-slate-800" dir="auto">
                {m.texte}
              </p>
              {m.reponseAuto && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">Réponse automatique envoyée : {m.reponseAuto.slice(0, 160)}{m.reponseAuto.length > 160 ? "…" : ""}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

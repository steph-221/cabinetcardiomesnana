import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Phone, UsersRound } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { inrHorsCible, perdusDeVue, type InrHorsCible, type PerduDeVue } from "../../../dossier/population";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";

export const metadata: Metadata = {
  title: "Population",
  robots: { index: false, follow: false },
};

export default async function Population({ params }: PageProps<"/[lang]/espace/population">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <UsersRound className="h-6 w-6 text-red-600" aria-hidden />
        Population
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Des repères sur l&apos;ensemble des dossiers, à vérifier patient par patient : INR hors zone cible et patients traités
        qu&apos;on n&apos;a pas revus.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

const jour = (d: string) => d.split("-").reverse().join("/");
const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

async function Contenu({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const aujourdhui = jourLocal(new Date());
  let inr: InrHorsCible[];
  let perdus: PerduDeVue[];
  try {
    [inr, perdus] = await Promise.all([inrHorsCible(), perdusDeVue(aujourdhui)]);
  } catch (erreur) {
    console.error(erreur);
    return <ErreurLecture />;
  }
  const lien = (id: number) => `/${langue}/espace/patients/${id}`;
  return (
    <>
      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">
          INR hors de la zone cible <span className="font-normal text-slate-400">({inr.length})</span>
        </h2>
        {inr.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun dernier INR hors zone (pour les patients qui ont une zone cible dans leur fiche).</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {inr.map((x) => (
              <li key={x.patientId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <Link href={lien(x.patientId)} className="font-medium text-slate-900 hover:text-red-700 hover:underline">
                  {x.nom.toUpperCase()} {x.prenom}
                </Link>
                <span className="text-slate-600">
                  INR {nombre(x.inr)} le {jour(x.date)}{" "}
                  <span className="text-slate-400">(cible {nombre(x.min)}–{nombre(x.max)})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-10">
        <h2 className="font-semibold text-slate-900">
          Traités mais pas revus depuis plus d&apos;un an <span className="font-normal text-slate-400">({perdus.length})</span>
        </h2>
        {perdus.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun patient concerné.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {perdus.map((x) => (
              <li key={x.patientId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <Link href={lien(x.patientId)} className="font-medium text-slate-900 hover:text-red-700 hover:underline">
                  {x.nom.toUpperCase()} {x.prenom}
                </Link>
                <span className="flex items-center gap-3 text-slate-600">
                  {x.derniere ? `dernière consultation le ${jour(x.derniere)}` : "aucune consultation enregistrée"} · {x.traitements} traitement(s)
                  {x.telephone && (
                    <a href={`tel:${x.telephone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-red-700">
                      <Phone className="h-3 w-3" aria-hidden />
                      {x.telephone}
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

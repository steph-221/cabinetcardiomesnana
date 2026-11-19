import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Ban, CalendarDays, FolderOpen, FolderPlus, OctagonAlert, TriangleAlert } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { ajouterJours, dateLocale, heureLocale, jourLocal } from "../../../agenda/creneaux";
import { agendaConfigure, listerRendezvous, type Rendezvous } from "../../../agenda/google";
import { accesMedical, exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { preparer, type Preparation } from "../../../dossier/preparation";
import { correspondances, type Correspondance } from "../../../dossier/rendez-vous";
import { paramsPrefill } from "../../../agenda/identite";
import { BaseNonConfiguree } from "../patients/commun";

export const metadata: Metadata = {
  title: "Ma journée",
  robots: { index: false, follow: false },
};

export default async function Journee({ params }: PageProps<"/[lang]/espace/aujourdhui">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement de la journée…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

const jour = (d: string) => d.split("-").reverse().join("/");
const court = (t: string, max = 220) => (t.length > max ? `${t.slice(0, max).trimEnd()}…` : t);

async function Contenu({ langue }: { langue: string }) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  const medical = accesMedical(utilisateur);
  const aujourdhui = jourLocal(new Date());
  const titre = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${aujourdhui}T12:00:00Z`));

  let rendezvous: Rendezvous[] | null = null;
  if (agendaConfigure()) {
    try {
      rendezvous = (await listerRendezvous(dateLocale(aujourdhui, "00:00"), dateLocale(ajouterJours(aujourdhui, 1), "00:00"))).filter(
        (r) => !r.fermeture && r.debut.length > 10,
      );
    } catch (erreur) {
      console.error(erreur);
    }
  }

  let dossiers = new Map<string, Correspondance>();
  const preparations = new Map<number, Preparation>();
  if (rendezvous && baseConfiguree()) {
    try {
      dossiers = await correspondances(rendezvous);
      if (medical) {
        const ids = [...new Set([...dossiers.values()].filter((c) => c.lien === "lie" || c.lien === "telephone").map((c) => c.patient.id))];
        for (const p of await Promise.all(ids.map((id) => preparer(id).catch(() => null)))) if (p) preparations.set(p.patientId, p);
      }
    } catch (erreur) {
      console.error(erreur);
    }
  }

  return (
    <>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <CalendarDays className="h-6 w-6 text-red-600" aria-hidden />
        <span className="first-letter:capitalize">{titre}</span>
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {medical
          ? "Les patients du jour, chacun avec ce qui a changé depuis sa dernière visite. Ce sont des aides : vous gardez la décision."
          : "Les rendez-vous du jour et leur dossier."}
      </p>
      {!baseConfiguree() && <BaseNonConfiguree />}
      {rendezvous === null ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
          Impossible de lire l&apos;agenda Google. Vérifiez la configuration (voir RESERVATION.md).
        </p>
      ) : rendezvous.length === 0 ? (
        <p className="mt-6 text-slate-500">Aucun rendez-vous aujourd&apos;hui.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rendezvous.map((r) => {
            const c = dossiers.get(r.id);
            const prep = c && (c.lien === "lie" || c.lien === "telephone") ? preparations.get(c.patient.id) : undefined;
            const nom = c ? `${c.patient.nom.toUpperCase()} ${c.patient.prenom}`.trim() : r.titre;
            return (
              <li key={r.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-slate-500">
                      {heureLocale(new Date(r.debut))}–{heureLocale(new Date(r.fin))}
                      {r.controle && <span className="ms-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">contrôle</span>}
                      {r.medecin && <span className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Dr {r.medecin}</span>}
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-slate-900">{nom}</p>
                    {r.motif && <p className="text-slate-500">{r.motif}</p>}
                  </div>
                  {c ? (
                    <Link href={`/${langue}/espace/patients/${c.patient.id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
                      <FolderOpen className="h-4 w-4" aria-hidden />
                      Ouvrir le dossier
                    </Link>
                  ) : (
                    <Link
                      href={`/${langue}/espace/patients/nouveau?${new URLSearchParams([...paramsPrefill(r), ["rdv", r.id]])}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                    >
                      <FolderPlus className="h-4 w-4" aria-hidden />
                      Créer le dossier
                    </Link>
                  )}
                </div>
                {c && c.lien !== "lie" && (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                    Dossier probable (même {c.lien === "telephone" ? "téléphone" : "identité"}) : à confirmer depuis l&apos;agenda.
                  </p>
                )}
                {prep && <Preparation_ prep={prep} langue={langue} />}
              </li>
            );
          })}
        </ul>
      )}
      {!medical && (
        <p className="mt-6 text-xs text-slate-400">
          <Ban className="me-1 inline h-3 w-3" aria-hidden />
          Le contenu médical des dossiers est réservé aux médecins.
        </p>
      )}
    </>
  );
}

function Preparation_({ prep, langue }: { prep: Preparation; langue: string }) {
  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      {prep.allergies && <p className="rounded-lg bg-red-50 p-2 font-medium text-red-800">Allergies : {prep.allergies}</p>}
      {prep.alertes.map((a, i) => (
        <p key={i} className={`flex items-start gap-2 rounded-lg p-2 ${a.niveau === "critique" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
          {a.niveau === "critique" ? <OctagonAlert className="h-4 w-4 shrink-0" aria-hidden /> : <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />}
          {a.texte}
        </p>
      ))}
      {prep.derniere ? (
        <p className="text-slate-700">
          <span className="font-medium">Dernière consultation le {jour(prep.derniere.date)}</span>
          {prep.derniere.motif && ` — ${prep.derniere.motif}`}
          {prep.derniere.conclusion && <span className="block text-slate-600">Conclusion : {court(prep.derniere.conclusion)}</span>}
          {prep.derniere.conduite && <span className="block text-slate-600">Conduite : {court(prep.derniere.conduite)}</span>}
        </p>
      ) : (
        <p className="text-slate-500">Aucune consultation enregistrée : première visite dans le dossier.</p>
      )}
      <ul className="flex flex-wrap gap-2 text-xs">
        {prep.resultatsARelire > 0 && (
          <li>
            <Link href={`/${langue}/espace/resultats`} className="rounded-full bg-sky-100 px-2 py-1 text-sky-900">
              {prep.resultatsARelire} résultat(s) d&apos;analyses à relire
            </Link>
          </li>
        )}
        {prep.examensDepuisDerniere > 0 && (
          <li className="rounded-full bg-sky-100 px-2 py-1 text-sky-900">{prep.examensDepuisDerniere} examen(s) depuis la dernière visite</li>
        )}
        {prep.suivisDus.map((s) => (
          <li key={`${s.quoi}${s.echeance}`} className={`rounded-full px-2 py-1 ${s.enRetard ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
            {s.quoi} — {s.enRetard ? "en retard depuis" : "prévu le"} {jour(s.echeance)}
          </li>
        ))}
      </ul>
      {prep.traitements.length > 0 && <p className="text-xs text-slate-500">Traitements en cours : {prep.traitements.join(" ; ")}</p>}
    </div>
  );
}

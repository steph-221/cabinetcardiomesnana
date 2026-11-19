import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Mail, Search } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { compteDrive } from "../../../dossier/drive";
import { libellePatient, rechercherPatients, type ResumePatient } from "../../../dossier/patients";
import { listerResultats, type Resultat } from "../../../dossier/resultats";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";
import { classer, confirmer, detacher, ignorer } from "./actions";

export const metadata: Metadata = {
  title: "Résultats reçus par email",
  robots: { index: false, follow: false },
};

export default async function Resultats({ params, searchParams }: PageProps<"/[lang]/espace/resultats">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Mail className="h-6 w-6 text-red-600" aria-hidden />
        Résultats reçus par email
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Les PDF des laboratoires arrivent ici depuis la boîte Gmail du cabinet. Quand le nom du patient est reconnu sans
        doute possible, le résultat est déjà classé dans son dossier : il reste à le confirmer. Sinon, choisissez le
        patient.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const date = (d: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(d));
const bouton = "rounded-full px-3 py-1.5 text-xs font-medium";

async function Contenu({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/resultats">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue);
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const params = await searchParams;
  const pour = Number(params.pour) || 0;
  const q = String(params.q ?? "").slice(0, 100);

  let resultats: Resultat[] | null = null;
  let trouves: ResumePatient[] = [];
  try {
    resultats = await listerResultats();
    if (pour && q) trouves = await rechercherPatients(q, 8);
  } catch (erreur) {
    console.error(erreur);
  }
  if (resultats === null) return <ErreurLecture />;
  const drive = Boolean(await compteDrive().catch(() => null));
  const attente = resultats.filter((r) => r.statut === "a_classer" || r.statut === "a_relire");
  const termines = resultats.filter((r) => r.statut === "valide" || r.statut === "ignore");

  return (
    <>
      {!process.env.RESULTATS_SECRET && (
        <p role="alert" className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          La réception par email n&apos;est pas encore activée (variable RESULTATS_SECRET) : voir RESULTATS.md.
        </p>
      )}
      {!drive && (
        <p role="alert" className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Google Drive n&apos;est pas connecté : les résultats ne peuvent pas être classés (voir l&apos;onglet Drive).
        </p>
      )}
      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">
          À traiter <span className="font-normal text-slate-400">({attente.length})</span>
        </h2>
        {attente.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Rien à traiter.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {attente.map((r) => (
              <li key={r.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      <a href={`/api/resultats/${r.id}`} target="_blank" rel="noreferrer" className="text-red-700 underline">
                        {r.nomFichier}
                      </a>
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.labo || r.expediteur} · {date(r.date)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.sujet}</p>
                  </div>
                  {r.statut === "a_relire" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">À relire</span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">À classer</span>
                  )}
                </div>

                {r.statut === "a_relire" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-700">
                      Classé dans{" "}
                      <Link href={`/${langue}/espace/patients/${r.patientId}`} className="font-medium text-red-700 underline">
                        {r.patientNom}
                      </Link>
                    </span>
                    <form action={confirmer.bind(null, langue, r.id)}>
                      <button className={`${bouton} bg-slate-900 text-white hover:bg-slate-800`}>C&apos;est le bon patient</button>
                    </form>
                    <form action={detacher.bind(null, langue, r.id)}>
                      <button className={`${bouton} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
                        Ce n&apos;est pas lui
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.candidats.map((c) => (
                        <form key={c.id} action={classer.bind(null, langue, r.id, c.id)}>
                          <button disabled={!drive} className={`${bouton} bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50`}>
                            {libellePatient(c)}
                          </button>
                        </form>
                      ))}
                      {r.candidats.length === 0 && <span className="text-slate-500">Aucun dossier reconnu.</span>}
                      <form action={ignorer.bind(null, langue, r.id)} className="ms-auto">
                        <button className={`${bouton} text-slate-500 hover:bg-slate-100`}>Ignorer</button>
                      </form>
                    </div>
                    <form role="search" className="flex gap-2">
                      <input type="hidden" name="pour" value={r.id} />
                      <label htmlFor={`q-${r.id}`} className="sr-only">
                        Chercher un autre patient
                      </label>
                      <input
                        id={`q-${r.id}`}
                        name="q"
                        defaultValue={pour === r.id ? q : ""}
                        placeholder="Chercher un autre patient (nom, téléphone)"
                        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                      />
                      <button className={`${bouton} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
                        <Search className="inline h-3.5 w-3.5" aria-hidden /> Chercher
                      </button>
                    </form>
                    {pour === r.id && q && (
                      <div className="flex flex-wrap gap-2">
                        {trouves.length === 0 && <span className="text-slate-500">Aucun patient trouvé.</span>}
                        {trouves.map((p) => (
                          <form key={p.id} action={classer.bind(null, langue, r.id, p.id)}>
                            <button disabled={!drive} className={`${bouton} border border-red-300 text-red-800 hover:bg-red-50 disabled:opacity-50`}>
                              {libellePatient(p)} · n° {p.id}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {termines.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold text-slate-900">Traités ces 14 derniers jours</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {termines.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="text-slate-700">
                  {r.nomFichier} <span className="text-slate-400">· {r.labo || r.expediteur}</span>
                </span>
                {r.statut === "valide" && r.patientId ? (
                  <Link href={`/${langue}/espace/patients/${r.patientId}`} className="text-red-700 underline">
                    {r.patientNom}
                  </Link>
                ) : (
                  <span className="text-slate-400">Ignoré</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

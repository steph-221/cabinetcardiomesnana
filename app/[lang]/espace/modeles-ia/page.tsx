import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Cpu } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { utilisateurConnecte } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { lireReglages, resumeUsage, type LigneUsage } from "../../../dossier/ia/usage";
import { libellesEffort, modeles, niveaux, efforts, taches, type Tache } from "../../../dossier/ia/taches";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";
import { regler } from "./actions";

export const metadata: Metadata = {
  title: "Modèles IA",
  robots: { index: false, follow: false },
};

export default async function ModelesIA({ params }: PageProps<"/[lang]/espace/modeles-ia">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Cpu className="h-6 w-6 text-red-600" aria-hidden />
        Modèles IA
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Chaque tâche confiée à Claude a son modèle et son niveau d&apos;effort : le modèle le moins cher qui suffit, avec
        une seconde tentative sur un modèle plus fort quand la réponse ne passe pas son contrôle. Les changements
        s&apos;appliquent aux appels suivants.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

const champ = "rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900";
const dollars = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

async function Contenu({ langue }: { langue: string }) {
  await connection();
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect(`/${langue}/espace/connexion`);
  if (!utilisateur.admin) redirect(`/${langue}/espace`);
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let reglages: Awaited<ReturnType<typeof lireReglages>>;
  let usage: LigneUsage[];
  try {
    [reglages, usage] = await Promise.all([lireReglages(), resumeUsage("Africa/Casablanca")]);
  } catch (erreur) {
    console.error(erreur);
    return <ErreurLecture />;
  }
  const mois = [...new Set(usage.map((u) => u.mois))];

  return (
    <>
      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        {(Object.keys(taches) as Tache[]).map((t) => {
          const d = taches[t];
          const r = reglages[t];
          const personnalise = r.niveau !== d.niveau || r.effort !== d.effort;
          return (
            <li key={t} className="p-4">
              <form action={regler.bind(null, langue, t)} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{d.libelle}</p>
                  <p className="text-xs text-slate-500">
                    Contrôle : {d.controle}
                    {d.escalade ? ` → ${modeles[d.escalade].nom}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select name="niveau" defaultValue={r.niveau} aria-label="Modèle" className={champ}>
                    {niveaux.map((n) => (
                      <option key={n} value={n}>
                        {modeles[n].nom}
                      </option>
                    ))}
                  </select>
                  <select name="effort" defaultValue={r.effort} aria-label="Effort" className={champ}>
                    {efforts.map((e) => (
                      <option key={e} value={e}>
                        effort {libellesEffort[e]}
                      </option>
                    ))}
                  </select>
                  <button name="action" value="enregistrer" className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
                    Appliquer
                  </button>
                  {personnalise && (
                    <button name="action" value="defaut" className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700">
                      Réglage de départ
                    </button>
                  )}
                </div>
              </form>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 font-semibold text-slate-900">Dépense estimée</h2>
      {usage.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Aucun appel à Claude pour le moment.</p>
      ) : (
        mois.map((m) => {
          const lignes = usage.filter((u) => u.mois === m);
          return (
            <div key={m} className="mt-4">
              <p className="text-sm font-medium text-slate-700">
                {m} — {dollars(lignes.reduce((n, l) => n + l.cout, 0))}
              </p>
              <div className="mt-1 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-2">Tâche</th>
                      <th className="p-2">Modèle</th>
                      <th className="p-2 text-right">Appels</th>
                      <th className="p-2 text-right">Jetons (entrée / sortie)</th>
                      <th className="p-2 text-right">Secondes tentatives</th>
                      <th className="p-2 text-right">Échecs</th>
                      <th className="p-2 text-right">Coût</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lignes.map((l) => (
                      <tr key={`${l.tache}-${l.niveau}`}>
                        <td className="p-2">{taches[l.tache as Tache]?.libelle ?? l.tache}</td>
                        <td className="p-2">{modeles[l.niveau as keyof typeof modeles]?.nom ?? l.niveau}</td>
                        <td className="p-2 text-right">{l.appels}</td>
                        <td className="p-2 text-right">
                          {l.entree.toLocaleString("fr-FR")} / {l.sortie.toLocaleString("fr-FR")}
                        </td>
                        <td className="p-2 text-right">{l.escalades}</td>
                        <td className="p-2 text-right">{l.echecs}</td>
                        <td className="p-2 text-right">{dollars(l.cout)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
      <p className="mt-3 text-xs text-slate-500">
        Coût calculé d&apos;après les tarifs publics (dollars par million de jetons) et les jetons rapportés par l&apos;API ;
        la facture d&apos;Anthropic fait foi.
      </p>
    </>
  );
}

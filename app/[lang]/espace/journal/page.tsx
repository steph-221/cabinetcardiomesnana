import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { cabinet, estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import {
  lireJournal,
  niveauAction,
  NIVEAUX,
  utilisateursJournal,
  type Entree,
  type Filtres,
} from "../../../dossier/journal";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";

export const metadata: Metadata = {
  title: "Journal des accès",
  robots: { index: false, follow: false },
};

export default async function Journal({ params, searchParams }: PageProps<"/[lang]/espace/journal">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="text-2xl font-bold text-slate-900">Journal des accès aux dossiers</h1>
      <p className="mt-1 text-sm text-slate-500">
        Qui a ouvert, créé ou modifié un dossier, et quand. Filtrez par niveau de criticité, utilisateur, période, dossier ou mot-clé. Les 200 dernières entrées.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Liste langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Liste({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/journal">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "admin");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const params = await searchParams;
  const un = (cle: string) => {
    const v = params[cle];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100) ?? "";
  };
  const date = (cle: string) => (/^\d{4}-\d{2}-\d{2}$/.test(un(cle)) ? un(cle) : "");
  const patient = Number(un("patient"));
  const niveau = NIVEAUX.find((n) => n.id === un("niveau"))?.id ?? null;
  const filtres: Filtres = {
    patientId: Number.isInteger(patient) && patient > 0 ? patient : null,
    qui: un("qui"),
    texte: un("q"),
    du: date("du"),
    au: date("au"),
    niveau,
  };
  const filtre = Object.values(filtres).some((v) => v !== null && v !== "");

  let entrees: Entree[] | null = null;
  let utilisateurs: string[] = [];
  try {
    [entrees, utilisateurs] = await Promise.all([lireJournal(filtres, cabinet.fuseau), utilisateursJournal()]);
  } catch (erreur) {
    console.error(erreur);
  }
  if (entrees === null) return <ErreurLecture />;
  const quand = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: cabinet.fuseau }).format(d);

  return (
    <>
      <form method="get" className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-slate-600">
          Niveau
          <select name="niveau" defaultValue={filtres.niveau ?? ""} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900">
            <option value="">Tous</option>
            {NIVEAUX.map((n) => (
              <option key={n.id} value={n.id}>
                {n.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-slate-600">
          Utilisateur
          <select name="qui" defaultValue={filtres.qui} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900">
            <option value="">Tous</option>
            {utilisateurs.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-slate-600">
          Du
          <input type="date" name="du" defaultValue={filtres.du} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900" />
        </label>
        <label className="grid gap-1 text-slate-600">
          Au
          <input type="date" name="au" defaultValue={filtres.au} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900" />
        </label>
        <label className="grid gap-1 text-slate-600">
          Dossier n°
          <input type="number" min={1} name="patient" defaultValue={filtres.patientId ?? ""} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900" />
        </label>
        <label className="grid gap-1 text-slate-600 sm:col-span-2">
          Action ou détail contient
          <input type="search" name="q" defaultValue={filtres.texte} placeholder="ex. facture, suppression, ordonnance…" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-900" />
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className="rounded-lg bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800">
            Filtrer
          </button>
          {filtre && (
            <Link href={`/${langue}/espace/journal`} className="py-2 text-red-700 underline">
              Réinitialiser
            </Link>
          )}
        </div>
      </form>
      <p className="mt-3 text-sm text-slate-500">
        {entrees.length} entrée{entrees.length > 1 ? "s" : ""}
        {filtre ? " correspondant aux filtres" : ""}
      </p>
      {entrees.length === 0 ? (
        <p className="mt-8 text-slate-500">Aucune entrée.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3 font-medium">Quand</th>
                <th className="p-3 font-medium">Qui</th>
                <th className="p-3 font-medium">Niveau</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entrees.map((e, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap p-3 text-slate-600">{quand(e.quand)}</td>
                  <td className="p-3 text-slate-900">{e.qui}</td>
                  <td className="p-3">
                    <Badge niveau={niveauAction(e.action)} />
                  </td>
                  <td className="p-3 text-slate-900">
                    {e.action}
                    {e.detail && <span className="ms-2 text-slate-500">{e.detail}</span>}
                  </td>
                  <td className="p-3">
                    {e.patientId && (
                      <Link href={`/${langue}/espace/patients/${e.patientId}`} className="text-red-700 hover:underline">
                        n° {e.patientId}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Badge({ niveau }: { niveau: (typeof NIVEAUX)[number]["id"] }) {
  const n = NIVEAUX.find((x) => x.id === niveau)!;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${n.classe}`}>{n.libelle}</span>;
}

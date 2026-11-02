import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, Download, TriangleAlert } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { bilan, listerPraticiens, miseEnCommun, serieAnnuelle, type Bilan } from "../../../dossier/compta";
import {
  bornes,
  libelleMode,
  mad,
  nomMois,
  periodeValide,
  periodeVoisine,
  repartir,
  titrePeriode,
} from "../../../dossier/compta-calculs";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";

export const metadata: Metadata = {
  title: "Comptabilité",
  robots: { index: false, follow: false },
};

export default async function Comptabilite({ params, searchParams }: PageProps<"/[lang]/espace/comptabilite">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Tableau langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Tableau({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/comptabilite">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;

  const aujourdhui = jourLocal(new Date());
  const demande = String((await searchParams).p ?? "");
  const periode = periodeValide(demande) ? demande : aujourdhui.slice(0, 7);
  const { du, au } = bornes(periode);
  const annee = Number(periode.slice(0, 4));

  let donnees: { b: Bilan; medecins: Awaited<ReturnType<typeof listerPraticiens>>; commun: boolean; serie: Awaited<ReturnType<typeof serieAnnuelle>> } | null = null;
  try {
    const [b, medecins, commun, serie] = await Promise.all([
      bilan(du, au),
      listerPraticiens(),
      miseEnCommun(),
      serieAnnuelle(annee),
    ]);
    donnees = { b, medecins, commun, serie };
  } catch (erreur) {
    console.error(erreur);
  }
  if (!donnees) return <ErreurLecture />;
  const { b, medecins, commun, serie } = donnees;

  const actifs = medecins.filter((m) => m.actif);
  // Un médecin inactif garde sa ligne s'il a encore des montants sur la période
  const concernes = medecins.filter(
    (m) => m.actif || b.encaisseParMedecin.has(m.id) || b.chargesPersoParMedecin.has(m.id),
  );
  const lignes = repartir(
    concernes.map((m) => ({ id: m.id, nom: m.nom, part: m.actif ? m.part : 0 })),
    b.encaisseParMedecin,
    b.chargesCommunes,
    b.chargesPersoParMedecin,
    commun,
  );
  const resultat = b.encaisseTotal - b.chargesTotal;
  const sommeParts = actifs.reduce((s, m) => s + m.part, 0);
  const base = `/${langue}/espace/comptabilite`;
  const lien = (p: string) => `${base}?p=${p}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Comptabilité</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={lien(periodeVoisine(periode, -1))} aria-label="Période précédente" className="rounded-full border border-slate-300 p-2 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <span className="min-w-36 text-center font-semibold text-slate-900 first-letter:capitalize">{titrePeriode(periode)}</span>
          <Link href={lien(periodeVoisine(periode, 1))} aria-label="Période suivante" className="rounded-full border border-slate-300 p-2 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <span className="mx-1 text-slate-300">|</span>
          {periode.length === 7 ? (
            <Link href={lien(periode.slice(0, 4))} className="text-red-700 hover:underline">
              Voir l&apos;année
            </Link>
          ) : (
            <Link href={lien(aujourdhui.slice(0, 7))} className="text-red-700 hover:underline">
              Voir le mois
            </Link>
          )}
        </div>
      </div>

      {actifs.length > 0 && sommeParts !== 100 && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Les parts des médecins totalisent {sommeParts} % au lieu de 100 %. Le partage reste proportionnel, mais
          vérifiez-les dans{" "}
          <Link href={`${base}/reglages`} className="underline">
            Réglages
          </Link>
          .
        </p>
      )}

      <section aria-label="Chiffres clés" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile titre="Encaissé" valeur={mad(b.encaisseTotal)} detail="honoraires reçus sur la période" />
        <Tuile titre="Charges" valeur={mad(b.chargesTotal)} detail="dépenses du cabinet" />
        <Tuile
          titre="Résultat"
          valeur={mad(resultat)}
          detail="encaissé − charges"
          ton={resultat < 0 ? "negatif" : "positif"}
        />
        <Tuile
          titre="Reste à encaisser"
          valeur={mad(b.impayes.totalCts)}
          detail={`${b.impayes.nombre} facture${b.impayes.nombre > 1 ? "s" : ""} ouverte${b.impayes.nombre > 1 ? "s" : ""}, toutes périodes`}
          lien={b.impayes.nombre > 0 ? `${base}/factures?statut=ouvertes` : undefined}
        />
      </section>
      <p className="mt-2 text-xs text-slate-500">
        Facturé sur la période : {mad(b.factureTotal)}. Les honoraires comptent à la date de l&apos;encaissement.
      </p>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Répartition entre les médecins</h2>
          <p className="text-xs text-slate-500">
            {commun
              ? "Résultat mis en commun : les honoraires sont partagés selon les parts."
              : "Chacun garde ses honoraires ; les charges communes sont partagées selon les parts."}
          </p>
        </div>
        {lignes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucun médecin enregistré.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Médecin</th>
                  <th className="px-4 py-2 text-right font-medium">Part</th>
                  <th className="px-4 py-2 text-right font-medium">Encaissé</th>
                  {commun && <th className="px-4 py-2 text-right font-medium">Sa part du pot</th>}
                  <th className="px-4 py-2 text-right font-medium">Charges communes</th>
                  <th className="px-4 py-2 text-right font-medium">Charges propres</th>
                  <th className="px-4 py-2 text-right font-medium">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lignes.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{l.nom}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.part} %</td>
                    <td className="px-4 py-3 text-right tabular-nums">{mad(l.encaisse)}</td>
                    {commun && <td className="px-4 py-3 text-right tabular-nums">{mad(l.recettes)}</td>}
                    <td className="px-4 py-3 text-right tabular-nums">{mad(l.chargesCommunes)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{mad(l.chargesPerso)}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${l.resultat < 0 ? "text-red-700" : "text-slate-900"}`}>
                      {mad(l.resultat)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-4 py-3">Cabinet</td>
                  <td />
                  <td className="px-4 py-3 text-right tabular-nums">{mad(b.encaisseTotal)}</td>
                  {commun && <td />}
                  <td className="px-4 py-3 text-right tabular-nums">{mad(b.chargesCommunes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{mad(b.chargesTotal - b.chargesCommunes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{mad(resultat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Le résultat est avant impôts et cotisations personnelles (IR, CNSS du médecin…).
        </p>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <Repartition
          titre="Encaissements par mode de paiement"
          vide="Aucun encaissement sur la période."
          lignes={[...b.encaisseParMode].map(([k, v]) => [libelleMode(k), v] as [string, number])}
        />
        <Repartition
          titre="Charges par catégorie"
          vide="Aucune charge sur la période."
          lignes={[...b.chargesParCategorie].map(([k, v]) => [k, v] as [string, number])}
          ton="ambre"
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Année {annee}, mois par mois</h2>
        <Graphique serie={serie} periode={periode} base={base} />
      </section>

      <section className="mt-10 rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Export pour le comptable</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fichiers CSV pour {titrePeriode(periode).toLowerCase()}, ouvrables dans Excel.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {(["recettes", "charges"] as const).map((type) => (
            <a
              key={type}
              href={`/api/comptabilite/export?p=${periode}&type=${type}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {type === "recettes" ? "Livre des recettes" : "Livre des dépenses"}
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

function Tuile({
  titre,
  valeur,
  detail,
  ton,
  lien,
}: {
  titre: string;
  valeur: string;
  detail: string;
  ton?: "positif" | "negatif";
  lien?: string;
}) {
  const contenu = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titre}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${ton === "negatif" ? "text-red-700" : "text-slate-900"}`}>{valeur}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </>
  );
  const classe = "rounded-2xl border border-slate-200 bg-white p-4";
  return lien ? (
    <Link href={lien} className={`${classe} block hover:border-red-300`}>
      {contenu}
    </Link>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

// Barres horizontales : la longueur donne la part du total, le montant est toujours écrit
function Repartition({
  titre,
  lignes,
  vide,
  ton = "rouge",
}: {
  titre: string;
  lignes: [string, number][];
  vide: string;
  ton?: "rouge" | "ambre";
}) {
  const tri = [...lignes].sort((a, b) => b[1] - a[1]);
  const total = tri.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>
      {tri.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{vide}</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {tri.map(([nom, v]) => (
            <li key={nom}>
              <div className="flex justify-between gap-3">
                <span className="text-slate-700">{nom}</span>
                <span className="tabular-nums text-slate-900">
                  {mad(v)} <span className="text-slate-400">· {Math.round((v / total) * 100)} %</span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${ton === "rouge" ? "bg-red-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.max(2, (v / total) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const COURTS = ["jan", "fév", "mars", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];

function Graphique({
  serie,
  periode,
  base,
}: {
  serie: { recettes: number; charges: number }[];
  periode: string;
  base: string;
}) {
  const annee = periode.slice(0, 4);
  const maximum = Math.max(1, ...serie.flatMap((m) => [m.recettes, m.charges]));
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" aria-hidden />
          Encaissé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden />
          Charges
        </span>
      </div>
      <div className="grid grid-cols-12 gap-1.5 sm:gap-3">
        {serie.map((m, i) => {
          const code = `${annee}-${String(i + 1).padStart(2, "0")}`;
          return (
            <Link
              key={code}
              href={`${base}?p=${code}`}
              title={`${nomMois(i + 1)} : encaissé ${mad(m.recettes)}, charges ${mad(m.charges)}`}
              aria-current={code === periode ? "date" : undefined}
              className={`group rounded-md p-1 ${code === periode ? "bg-red-50" : "hover:bg-slate-50"}`}
            >
              <div className="flex h-32 items-end justify-center gap-0.5">
                <div className="w-1/2 rounded-t bg-red-500" style={{ height: `${(m.recettes / maximum) * 100}%` }} />
                <div className="w-1/2 rounded-t bg-amber-500" style={{ height: `${(m.charges / maximum) * 100}%` }} />
              </div>
              <p className="mt-1 text-center text-[10px] text-slate-500 sm:text-xs">{COURTS[i]}</p>
              <span className="sr-only">
                {nomMois(i + 1)} : encaissé {mad(m.recettes)}, charges {mad(m.charges)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

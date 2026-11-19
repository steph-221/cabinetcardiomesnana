import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { connection } from "next/server";
import { ArrowDownRight, ArrowUpRight, Check, Minus } from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { jourLocal } from "../../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { listerPraticiens } from "../../../../dossier/compta";
import { libelleMode, mad } from "../../../../dossier/compta-calculs";
import { statistiques, type LigneActe, type Statistiques } from "../../../../dossier/compta-stats";
import {
  dateLongue,
  estGranularite,
  granularites,
  lirePeriode,
  raccourcis,
  seauxJoursSemaine,
  somme,
  variation,
  type Granularite,
  type Variation,
} from "../../../../dossier/compta-stats-calculs";
import { BaseNonConfiguree, ErreurLecture } from "../../patients/commun";
import { GraphiqueEmpile } from "./graphique";

export const metadata: Metadata = {
  title: "Statistiques de la comptabilité",
  robots: { index: false, follow: false },
};

export default async function PageStatistiques({ params, searchParams }: PageProps<"/[lang]/espace/comptabilite/statistiques">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const nombre = new Intl.NumberFormat("fr-FR");
const pluriel = (n: number, mot: string) => `${nombre.format(n)} ${mot}${n > 1 ? "s" : ""}`;

// La couleur suit le médecin (son rang dans la liste par identifiant), jamais son classement du moment
const couleurMedecin = (rang: number) => (rang < 8 ? `var(--serie-${rang + 1})` : "var(--serie-autres)");

async function Contenu({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/comptabilite/statistiques">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;

  const requete = await searchParams;
  const aujourdhui = jourLocal(new Date());
  const periode = lirePeriode({ p: un(requete.p), du: un(requete.du), au: un(requete.au) }, aujourdhui);
  const regroupementDemande: Granularite | null = estGranularite(un(requete.g)) ? (un(requete.g) as Granularite) : null;

  let stats: Statistiques | null = null;
  let medecinChoisi: number | null = null;
  try {
    const tous = await listerPraticiens();
    const demande = Number(un(requete.m));
    medecinChoisi = Number.isInteger(demande) && tous.some((p) => p.id === demande) ? demande : null;
    stats = await statistiques({ du: periode.du, au: periode.au, praticienId: medecinChoisi, regroupement: regroupementDemande });
  } catch (erreur) {
    console.error(erreur);
  }
  if (!stats) return <ErreurLecture />;

  const base = `/${langue}/espace/comptabilite/statistiques`;
  const { courant, precedent } = stats;

  // Médecins ayant eu une activité sur la période : les séries des graphiques, avec leur couleur fixe
  const actifs = stats.praticiens
    .map((p, rang) => ({ p, rang, fiche: stats.parMedecin.get(p.id) }))
    .filter((x) => x.fiche && (x.fiche.consultations > 0 || x.fiche.encaisseCts > 0));
  const series = actifs.map((x) => ({ id: String(x.p.id), nom: x.p.nom, couleur: couleurMedecin(x.rang) }));
  const colonnes = actifs.map((x) => x.rang);
  const garder = (m: number[][]) => m.map((ligne) => colonnes.map((j) => ligne[j]));

  const parTitre = { jour: "par jour", semaine: "par semaine", mois: "par mois" }[stats.regroupement];
  const medecinNom = medecinChoisi === null ? "tous les médecins" : (stats.praticiens.find((p) => p.id === medecinChoisi)?.nom ?? "");
  const etMedecin = medecinChoisi === null ? " et par médecin" : ` (${medecinNom})`;
  const payantes = courant.consultations - courant.gratuites;
  const panier = payantes > 0 ? courant.factureCts / payantes : 0;
  const payantesAvant = precedent ? precedent.totaux.consultations - precedent.totaux.gratuites : 0;
  const panierAvant = precedent && payantesAvant > 0 ? precedent.totaux.factureCts / payantesAvant : 0;
  const lienRaccourci = (id: string) => {
    const q = new URLSearchParams({ p: id });
    if (medecinChoisi !== null) q.set("m", String(medecinChoisi));
    if (regroupementDemande) q.set("g", regroupementDemande);
    return `${base}?${q}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Statistiques</h1>
        <p className="text-sm text-slate-500">
          Du {dateLongue(stats.du)} au {dateLongue(stats.au)} · {parTitre} · {medecinNom}
        </p>
      </div>

      {/* Un seul bandeau de filtres, au-dessus de tout ce qu'il règle */}
      <section aria-label="Filtres" className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {raccourcis.map((r) => {
            const actif = periode.raccourci === r.id;
            return (
              <Link
                key={r.id}
                href={lienRaccourci(r.id)}
                aria-current={actif ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                  actif ? "border-red-600 bg-red-50 font-medium text-red-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {actif && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                {r.libelle}
              </Link>
            );
          })}
        </div>
        <Form
          key={`${stats.du}-${stats.au}-${medecinChoisi}-${regroupementDemande}`}
          action={base}
          className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 text-sm"
        >
          <label className="grid gap-1 text-xs text-slate-500">
            Du
            <input type="date" name="du" required defaultValue={stats.du} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900" />
          </label>
          <label className="grid gap-1 text-xs text-slate-500">
            Au
            <input type="date" name="au" required defaultValue={stats.au} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900" />
          </label>
          <label className="grid gap-1 text-xs text-slate-500">
            Médecin
            <select name="m" defaultValue={medecinChoisi === null ? "" : String(medecinChoisi)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900">
              <option value="">Tous les médecins</option>
              {stats.praticiens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                  {p.actif ? "" : " (inactif)"}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-500">
            Regrouper
            <select name="g" defaultValue={regroupementDemande ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900">
              <option value="">Automatique</option>
              {granularites.map((g) => (
                <option key={g.valeur} value={g.valeur}>
                  {g.libelle}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Appliquer
          </button>
        </Form>
        {regroupementDemande && regroupementDemande !== stats.regroupement && (
          <p className="mt-2 text-xs text-amber-800">
            « {granularites.find((g) => g.valeur === regroupementDemande)?.libelle.toLowerCase()} » serait illisible sur une période aussi longue : le
            regroupement est passé {parTitre}.
          </p>
        )}
      </section>

      <section aria-label="Chiffres clés" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tuile
          titre="Encaissé"
          valeur={mad(courant.encaisseCts, true)}
          detail="honoraires reçus (date du paiement)"
          variation={precedent ? variation(courant.encaisseCts, precedent.totaux.encaisseCts) : null}
        />
        <Tuile
          titre="Facturé"
          valeur={mad(courant.factureCts, true)}
          detail="montant des factures de la période"
          variation={precedent ? variation(courant.factureCts, precedent.totaux.factureCts) : null}
        />
        <Tuile
          titre="Consultations"
          valeur={nombre.format(courant.consultations)}
          detail={
            courant.joursActifs > 0
              ? `≈ ${nombre.format(Math.round(courant.consultations / courant.joursActifs))} par jour d'activité (${pluriel(courant.joursActifs, "jour")})`
              : "aucune sur la période"
          }
          variation={precedent ? variation(courant.consultations, precedent.totaux.consultations) : null}
        />
        <Tuile
          titre="Panier moyen"
          valeur={payantes > 0 ? mad(Math.round(panier), true) : "–"}
          detail="facturé ÷ consultations payantes"
          variation={panierAvant > 0 ? variation(panier, panierAvant) : null}
        />
        <Tuile
          titre="Gratuites"
          valeur={nombre.format(courant.gratuites)}
          detail={courant.consultations > 0 ? `${Math.round((courant.gratuites / courant.consultations) * 100)} % des consultations` : "–"}
          variation={precedent ? variation(courant.gratuites, precedent.totaux.gratuites) : null}
          neutre
        />
      </section>
      {precedent && precedent.totaux.consultations > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Évolution par rapport à la période de même durée qui précède (du {dateLongue(precedent.du)} au {dateLongue(precedent.au)}).
        </p>
      )}

      <div className="mt-8 space-y-6">
        <GraphiqueEmpile
          titre={`Chiffre d'affaires encaissé, ${parTitre}${etMedecin}`}
          description="Honoraires comptés à la date du paiement."
          format="mad"
          seaux={stats.seaux}
          series={series}
          valeurs={garder(stats.encaisse)}
        />
        <GraphiqueEmpile
          titre={`Consultations, ${parTitre}${etMedecin}`}
          description="Factures non annulées à la date de la facture, consultations gratuites comprises."
          format="nombre"
          unite={["consultation", "consultations"]}
          seaux={stats.seaux}
          series={series}
          valeurs={garder(stats.consultations)}
        />
      </div>

      {actifs.length > 0 && <TableauMedecins actifs={actifs} stats={stats} />}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Actes</h2>
        <p className="mt-1 text-xs text-slate-500">
          Lignes de facture, à la date de la facture. Les montants sont ceux des lignes, avant remise éventuelle.
        </p>
        {stats.actes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucun acte facturé sur la période.</p>
        ) : (
          <div className="mt-4 space-y-8">
            <Classement
              className="max-w-3xl"
              titre="Nombre d'actes par type"
              lignes={stats.actes.slice(0, 12).map((a) => ({
                nom: a.libelle,
                valeur: a.quantite,
                texte: nombre.format(a.quantite),
                detail: mad(a.totalCts, true),
              }))}
              reste={stats.actes.length - 12}
            />
            <Chaleur actes={stats.actes} seaux={stats.seaux} />
          </div>
        )}
      </section>

      <section className="mt-10">
        <GraphiqueEmpile
          titre="Fréquentation par jour de la semaine"
          description="Consultations de la période, regroupées par jour de la semaine."
          format="nombre"
          unite={["consultation", "consultations"]}
          seaux={seauxJoursSemaine}
          series={series}
          valeurs={garder(stats.joursSemaine)}
        />
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <Classement
          titre="Encaissements par mode de paiement"
          vide="Aucun encaissement sur la période."
          lignes={stats.modes.map((m) => ({ nom: libelleMode(m.mode), valeur: m.totalCts, texte: mad(m.totalCts, true), detail: pluriel(m.nombre, "paiement") }))}
          partDuTotal
        />
        <Classement
          titre="Mutuelles et assurances"
          vide="Aucun paiement par mutuelle sur la période."
          lignes={stats.assureurs.slice(0, 8).map((a) => ({ nom: a.nom, valeur: a.totalCts, texte: mad(a.totalCts, true), detail: pluriel(a.nombre, "paiement") }))}
          reste={stats.assureurs.length - 8}
          partDuTotal
        />
      </section>

      <p className="mt-10 text-xs text-slate-500">
        Les factures annulées ne sont jamais comptées. L&apos;encaissé suit la date du paiement ; les consultations, le facturé et les actes suivent la date
        de la facture, comme dans le livre des recettes.
      </p>
    </>
  );
}

// --- Indicateurs ---

function Tuile({
  titre,
  valeur,
  detail,
  variation: v,
  neutre = false,
}: {
  titre: string;
  valeur: string;
  detail: string;
  variation: Variation | null;
  neutre?: boolean; // une hausse n'est ni bonne ni mauvaise (consultations gratuites)
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titre}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{valeur}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
      {v && <Evolution v={v} neutre={neutre} />}
    </div>
  );
}

// L'icône et le signe portent le sens, la couleur ne fait que le souligner
function Evolution({ v, neutre }: { v: Variation; neutre: boolean }) {
  const Icone = v.sens === "hausse" ? ArrowUpRight : v.sens === "baisse" ? ArrowDownRight : Minus;
  const couleur = neutre || v.sens === "stable" ? "#52514e" : v.sens === "hausse" ? "#006300" : "#d03b3b";
  const signe = v.pourcent > 0 ? "+" : v.pourcent < 0 ? "−" : "";
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1 text-xs font-medium" style={{ color: couleur }}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Icone className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        {v.sens === "stable" ? "Stable" : `${signe}${nombre.format(Math.abs(v.pourcent))} %`}
      </span>
      <span className="font-normal text-slate-500">vs période précédente</span>
    </p>
  );
}

// --- Médecins ---

function TableauMedecins({
  actifs,
  stats,
}: {
  actifs: { p: Statistiques["praticiens"][number]; rang: number; fiche?: { consultations: number; gratuites: number; factureCts: number; encaisseCts: number } }[];
  stats: Statistiques;
}) {
  const totalEncaisse = stats.courant.encaisseCts;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-900">Médecin par médecin</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Médecin</th>
              <th className="px-4 py-2 text-right font-medium">Consultations</th>
              <th className="px-4 py-2 text-right font-medium">Gratuites</th>
              <th className="px-4 py-2 text-right font-medium">Facturé</th>
              <th className="px-4 py-2 text-right font-medium">Encaissé</th>
              <th className="px-4 py-2 text-right font-medium">Panier moyen</th>
              <th className="px-4 py-2 font-medium">Part de l&apos;encaissé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actifs.map(({ p, rang, fiche }) => {
              const f = fiche!;
              const payantes = f.consultations - f.gratuites;
              const part = totalEncaisse > 0 ? f.encaisseCts / totalEncaisse : 0;
              return (
                <tr key={p.id}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: couleurMedecin(rang) }} aria-hidden />
                      {p.nom}
                    </span>
                  </th>
                  <td className="px-4 py-3 text-right tabular-nums">{nombre.format(f.consultations)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{nombre.format(f.gratuites)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{mad(f.factureCts, true)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{mad(f.encaisseCts, true)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{payantes > 0 ? mad(Math.round(f.factureCts / payantes), true) : "–"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(part > 0 ? 3 : 0, part * 100)}%`, background: couleurMedecin(rang) }} />
                      </div>
                      <span className="text-xs tabular-nums text-slate-600">{part > 0 && part < 0.005 ? "< 1" : Math.round(part * 100)} %</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {actifs.length > 1 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
              <tr>
                <th scope="row" className="px-4 py-3 text-left">Cabinet</th>
                <td className="px-4 py-3 text-right tabular-nums">{nombre.format(stats.courant.consultations)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{nombre.format(stats.courant.gratuites)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{mad(stats.courant.factureCts, true)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{mad(stats.courant.encaisseCts, true)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {stats.courant.consultations - stats.courant.gratuites > 0
                    ? mad(Math.round(stats.courant.factureCts / (stats.courant.consultations - stats.courant.gratuites)), true)
                    : "–"}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

// --- Classement en barres horizontales (une seule teinte : l'ordre vient de la longueur, pas de la couleur) ---

function Classement({
  titre,
  lignes,
  vide = "Aucune donnée sur la période.",
  reste = 0,
  partDuTotal = false,
  className = "",
}: {
  className?: string;
  titre: string;
  lignes: { nom: string; valeur: number; texte: string; detail?: string }[];
  vide?: string;
  reste?: number; // lignes non affichées
  partDuTotal?: boolean; // ajoute la part de chaque ligne dans le total affiché
}) {
  const maximum = Math.max(1, ...lignes.map((l) => l.valeur));
  const total = somme(lignes.map((l) => l.valeur));
  return (
    <div className={className}>
      <h3 className="font-semibold text-slate-900">{titre}</h3>
      {lignes.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{vide}</p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {lignes.map((l) => (
            <li key={l.nom}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-slate-700" title={l.nom}>
                  {l.nom}
                </span>
                <span className="shrink-0 text-slate-900">
                  <span className="font-medium tabular-nums">{l.texte}</span>
                  {(l.detail || partDuTotal) && (
                    <span className="text-slate-400">
                      {" "}
                      · {l.detail}
                      {partDuTotal && total > 0 ? `${l.detail ? " · " : ""}${Math.round((l.valeur / total) * 100)} %` : ""}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(l.valeur > 0 ? 2 : 0, (l.valeur / maximum) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {reste > 0 && <p className="mt-3 text-xs text-slate-500">+ {reste} autre{reste > 1 ? "s" : ""} non affiché{reste > 1 ? "s" : ""}.</p>}
    </div>
  );
}

// --- Carte de chaleur : actes × période ---

// Une teinte (bleu, du clair au foncé) ; les trois plus claires portent du texte noir, les autres du texte blanc
const RAMPE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#2a78d6", "#256abf", "#1c5cab", "#184f95"];

function Chaleur({ actes, seaux }: { actes: LigneActe[]; seaux: Statistiques["seaux"] }) {
  const affiches = actes.slice(0, 12);
  const autres = actes.slice(12);
  const lignes: LigneActe[] = autres.length
    ? [
        ...affiches,
        {
          libelle: `Autres actes (${autres.length})`,
          quantite: somme(autres.map((a) => a.quantite)),
          totalCts: somme(autres.map((a) => a.totalCts)),
          parSeau: seaux.map((_, i) => somme(autres.map((a) => a.parSeau[i]))),
        },
      ]
    : affiches;
  const maximum = Math.max(1, ...lignes.flatMap((a) => a.parSeau));
  return (
    <div className="min-w-0">
      <h3 className="font-semibold text-slate-900">Actes par type et par période</h3>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="sticky left-0 z-10 min-w-40 bg-white px-3 py-2 font-medium">Acte</th>
              {seaux.map((s) => (
                <th key={s.cle} className="whitespace-nowrap px-1 py-2 text-center font-medium">
                  {s.court}
                  {s.annee && <span className="block font-normal text-slate-400">{s.annee}</span>}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((a) => (
              <tr key={a.libelle}>
                <th scope="row" className="sticky left-0 z-10 max-w-56 bg-white px-3 py-1 text-left font-normal text-slate-700">
                  <span className="block truncate" title={a.libelle}>
                    {a.libelle}
                  </span>
                </th>
                {a.parSeau.map((v, i) => {
                  const teinte = v > 0 ? Math.min(RAMPE.length - 1, Math.max(0, Math.ceil((v / maximum) * RAMPE.length) - 1)) : -1;
                  return (
                    <td key={seaux[i].cle} className="p-0.5" title={`${a.libelle} · ${seaux[i].long} : ${nombre.format(v)}`}>
                      <div
                        className="grid h-8 min-w-9 place-items-center rounded-md tabular-nums"
                        style={teinte >= 0 ? { background: RAMPE[teinte], color: teinte < 3 ? "#0b0b0b" : "#ffffff" } : undefined}
                      >
                        {v > 0 ? nombre.format(v) : ""}
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-1 text-right font-semibold tabular-nums text-slate-900">{nombre.format(a.quantite)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500" aria-hidden>
        moins
        {RAMPE.map((c) => (
          <span key={c} className="h-3 w-5 rounded-sm" style={{ background: c }} />
        ))}
        plus
      </div>
    </div>
  );
}

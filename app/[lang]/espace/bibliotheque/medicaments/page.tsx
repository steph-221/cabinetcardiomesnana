import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { after, connection } from "next/server";
import { AlertTriangle, ExternalLink, Pill, Search } from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { familles, libelleFamille, situations } from "../../../../dossier/cardio-medicaments";
import { formes, laboratoires, oublierCopie, rechercherMedicaments, type Criteres } from "../../../../dossier/medicaments-ma";
import {
  bilanVeille,
  changementsOuverts,
  etatVeille,
  patientsConcernes,
  verificationNecessaire,
  verifierMedicaments,
  type Changement,
  type PatientConcerne,
} from "../../../../dossier/veille-medicaments";
import { BaseNonConfiguree, ErreurLecture, Retour } from "../../patients/commun";
import { Categories } from "../categories";
import { BoutonVerifier } from "./boutons";
import { changementVu, tousVus } from "./actions";

export const metadata: Metadata = {
  title: "Médicaments de référence",
  robots: { index: false, follow: false },
};

// La vérification de medicament.ma (26 lettres) peut prendre quelques dizaines de secondes
export const maxDuration = 60;

export default async function Medicaments({ params, searchParams }: PageProps<"/[lang]/espace/bibliotheque/medicaments">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/bibliotheque`}>Retour à la bibliothèque</Retour>
      <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Pill className="h-6 w-6 text-red-600" aria-hidden />
        Médicaments de référence
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Copie de la base publique{" "}
        <a href="https://medicament.ma/" target="_blank" rel="noopener noreferrer" className="text-red-700 underline">
          medicament.ma
        </a>{" "}
        : chaque nom ouvre la fiche officielle dans un nouvel onglet. Le site est relu chaque jour ; tout ajout, retrait,
        changement de prix ou de nom est signalé ici, avec les patients concernés si le médicament a été prescrit.
      </p>
      <Categories langue={lang} active="medicaments" />
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const date = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" });

const typesChangement: Record<string, { libelle: string; classe: string }> = {
  retrait: { libelle: "Retiré", classe: "bg-red-100 text-red-800" },
  modification: { libelle: "Modifié", classe: "bg-amber-100 text-amber-900" },
  ajout: { libelle: "Nouveau", classe: "bg-emerald-100 text-emerald-800" },
  inaccessible: { libelle: "Inaccessible", classe: "bg-slate-200 text-slate-800" },
  doute: { libelle: "Doute", classe: "bg-purple-100 text-purple-900" },
};

const nombre = (v: string | string[] | undefined) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const chaine = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 80) : "");

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-xs font-medium text-slate-600";

async function Contenu({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/bibliotheque/medicaments">["searchParams"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  const sp = await searchParams;
  const criteres: Criteres = {
    q: chaine(sp.q),
    situation: chaine(sp.situation),
    famille: chaine(sp.famille),
    forme: chaine(sp.forme),
    type: sp.type === "generique" || sp.type === "princeps" ? sp.type : "",
    labo: chaine(sp.labo),
    prixMax: nombre(sp.prixMax),
    commercialises: sp.tous !== "1",
    tri: sp.tri === "prix" || sp.tri === "nom" ? sp.tri : "pertinence",
  };
  const recherche = Boolean(criteres.q || criteres.situation || criteres.famille || criteres.forme || criteres.type || criteres.labo || criteres.prixMax);

  let changements: Changement[] | null = null;
  let patients = new Map<number, PatientConcerne[]>();
  let etat: Awaited<ReturnType<typeof etatVeille>> | null = null;
  let problemes: Awaited<ReturnType<typeof bilanVeille>> = [];
  let resultats: Awaited<ReturnType<typeof rechercherMedicaments>> | null = null;
  let labos: string[] = [];
  try {
    [changements, etat, problemes, resultats, labos] = await Promise.all([
      changementsOuverts(),
      etatVeille(),
      bilanVeille(),
      recherche ? rechercherMedicaments(criteres, 60) : null,
      laboratoires(),
    ]);
    const concernes = changements.filter((c) => c.patients > 0).slice(0, 25);
    patients = new Map(await Promise.all(concernes.map(async (c) => [c.id, await patientsConcernes(c.url, c.nom)] as const)));
  } catch (erreur) {
    console.error(erreur);
  }
  if (changements === null || etat === null) return <ErreurLecture />;

  // Relecture quotidienne du site après l'affichage (reprend là où la précédente s'est arrêtée)
  after(async () => {
    try {
      if (await verificationNecessaire()) {
        await verifierMedicaments(50_000);
        oublierCopie();
      }
    } catch (erreur) {
      console.error(erreur);
    }
  });

  const prescrits = changements.filter((c) => c.patients > 0 && c.type !== "ajout");
  const autres = changements.filter((c) => !prescrits.includes(c));

  return (
    <>
      <section className="mt-6 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
        <div>
          <p className="font-medium text-slate-900">
            {etat.total} médicaments suivis ·{" "}
            {etat.termineLe ? `vérifié le ${date(etat.termineLe)}` : "jamais vérifié en entier"}
            {etat.enCours && ` · en cours (${etat.lettresFaites}/26 lettres)`}
          </p>
          <p className="text-xs text-slate-500">
            La carte du site (nom, présentation, prix, laboratoire de chaque médicament) est comparée lettre par lettre.
            Rien n&apos;est retiré sur un simple doute : un retrait n&apos;est enregistré que si la fiche elle-même
            n&apos;existe plus.
          </p>
        </div>
        <BoutonVerifier langue={langue} />
      </section>

      {problemes.length > 0 && (
        <section className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-950">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Lecture incertaine de certaines pages du site
          </h2>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {problemes.map((p) => (
              <li key={p.lettre}>
                Lettre {p.lettre} : {p.raison}
                {p.statut === "erreur" ? " (page inaccessible)" : " (lecture douteuse, rien n'a été retiré)"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {prescrits.length > 0 && (
        <section className="mt-6" aria-labelledby="alertes">
          <h2 id="alertes" className="flex items-center gap-2 font-semibold text-red-800">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            Médicaments prescrits : changements à regarder ({prescrits.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {prescrits.map((c) => (
              <LigneChangement key={c.id} c={c} langue={langue} patients={patients.get(c.id) ?? []} />
            ))}
          </ul>
        </section>
      )}

      {autres.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">
              Autres changements sur le site <span className="font-normal text-slate-400">({autres.length})</span>
            </h2>
            {autres.some((c) => c.type === "ajout") && (
              <form action={tousVus.bind(null, langue)}>
                <button type="submit" className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                  Marquer les nouveautés comme vues
                </button>
              </form>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {autres.slice(0, 80).map((c) => (
              <LigneChangement key={c.id} c={c} langue={langue} patients={[]} />
            ))}
          </ul>
          {autres.length > 80 && <p className="mt-2 text-xs text-slate-500">{autres.length - 80} autres non affichés.</p>}
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-slate-200 p-4 sm:p-6" aria-labelledby="recherche">
        <h2 id="recherche" className="flex items-center gap-2 font-semibold text-slate-900">
          <Search className="h-4 w-4" aria-hidden />
          Chercher un médicament
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Par nom, substance ou laboratoire, ou par situation clinique : choisissez ce que vous traitez (hypertension,
          fibrillation atriale, angor…) et les familles utiles s&apos;affichent, avec toutes les marques disponibles au
          Maroc.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {situations.map((s) => (
            <Link
              key={s.cle}
              href={`?situation=${s.cle}`}
              title={s.indice}
              className={`rounded-full border px-3 py-1 text-xs ${
                criteres.situation === s.cle ? "border-red-600 bg-red-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {s.libelle}
            </Link>
          ))}
        </div>
        <form method="get" className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className={`${etiquette} sm:col-span-3`}>
            Nom, substance ou laboratoire
            <input name="q" defaultValue={criteres.q} placeholder="ex. bisoprolol, Eliquis, rivaroxaban" className={champ} />
          </label>
          <label className={etiquette}>
            Situation clinique
            <select name="situation" defaultValue={criteres.situation} className={champ}>
              <option value="">Toutes</option>
              {situations.map((s) => (
                <option key={s.cle} value={s.cle}>
                  {s.libelle} — {s.indice}
                </option>
              ))}
            </select>
          </label>
          <label className={etiquette}>
            Famille
            <select name="famille" defaultValue={criteres.famille} className={champ}>
              <option value="">Toutes</option>
              {familles.map((f) => (
                <option key={f.cle} value={f.cle}>
                  {f.libelle}
                </option>
              ))}
            </select>
          </label>
          <label className={etiquette}>
            Forme
            <select name="forme" defaultValue={criteres.forme} className={champ}>
              <option value="">Toutes</option>
              {formes.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className={etiquette}>
            Générique ou princeps
            <select name="type" defaultValue={criteres.type} className={champ}>
              <option value="">Tous</option>
              <option value="generique">Génériques</option>
              <option value="princeps">Princeps</option>
            </select>
          </label>
          <label className={etiquette}>
            Laboratoire
            <input name="labo" list="laboratoires" defaultValue={criteres.labo} className={champ} />
            <datalist id="laboratoires">
              {labos.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>
          <label className={etiquette}>
            Prix maximum (PPV, dhs)
            <input name="prixMax" inputMode="decimal" defaultValue={criteres.prixMax ?? ""} className={champ} />
          </label>
          <label className={etiquette}>
            Trier par
            <select name="tri" defaultValue={criteres.tri} className={champ}>
              <option value="pertinence">Pertinence</option>
              <option value="prix">Prix croissant</option>
              <option value="nom">Nom</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-slate-600">
            <input type="checkbox" name="tous" value="1" defaultChecked={!criteres.commercialises} />
            Inclure les médicaments non commercialisés
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
              Chercher
            </button>
            {recherche && (
              <Link href="?" className="rounded-full border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Réinitialiser
              </Link>
            )}
          </div>
        </form>

        {resultats && (
          <div className="mt-5">
            <p className="text-sm text-slate-600">
              {resultats.total} résultat(s){resultats.total > resultats.resultats.length ? ` — les ${resultats.resultats.length} premiers` : ""}
            </p>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {resultats.resultats.map((m) => (
                <li key={m.url} className="p-3">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-red-700 hover:underline"
                  >
                    {m.nom}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                  <p className="text-xs text-slate-600">
                    {[m.dci, m.dosage, m.presentation, m.labo, m.ppv && `PPV ${m.ppv}`, m.generique ? "générique" : "princeps"]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {m.familles.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {m.familles.map((f) => (
                        <span key={f} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {libelleFamille(f)}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

function LigneChangement({ c, langue, patients }: { c: Changement; langue: string; patients: PatientConcerne[] }) {
  const t = typesChangement[c.type];
  return (
    <li className={`rounded-xl border p-3 text-sm ${c.patients > 0 ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`me-2 rounded-full px-2 py-0.5 text-xs font-medium ${t.classe}`}>{t.libelle}</span>
          {c.url.startsWith("https://medicament.ma/") ? (
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:text-red-700 hover:underline">
              {c.nom}
            </a>
          ) : (
            <span className="font-medium text-slate-900">{c.nom}</span>
          )}
          <p className="mt-1 text-xs text-slate-600">{c.detail}</p>
          <p className="text-xs text-slate-400">détecté le {date(c.detecteLe)}</p>
        </div>
        <form action={changementVu.bind(null, langue, c.id)}>
          <button type="submit" className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
            Marquer comme vu
          </button>
        </form>
      </div>
      {c.patients > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-red-800">
            {c.patients} patient(s) concerné(s)
          </summary>
          <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
            {patients.map((p, i) => (
              <li key={`${p.id}-${p.origine}-${i}`} className="text-xs">
                <Link href={`/${langue}/espace/patients/${p.id}`} className="text-red-700 underline">
                  {p.nom} {p.prenom}
                </Link>{" "}
                <span className="text-slate-500">
                  {p.origine === "ordonnance" ? "ordonnance" : "traitement en cours"}
                  {p.date ? ` du ${p.date.split("-").reverse().join("/")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

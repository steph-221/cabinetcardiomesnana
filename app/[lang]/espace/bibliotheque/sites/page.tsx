import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { after, connection } from "next/server";
import { BookCheck, ExternalLink, FilePlus2, Globe, Headphones, Search } from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { typesSource } from "../../../../dossier/sources";
import { listerSites, sitesARelire, verifierSite, type SiteSuivi } from "../../../../dossier/veille";
import { BaseNonConfiguree, ErreurLecture, Retour } from "../../patients/commun";
import { Categories } from "../categories";
import { SITES_PROPOSES } from "../../../../dossier/sites-proposes";
import { AccesAbonne, BoutonsSite, FormulaireSite, SuivreSitePropose, ToutVerifier } from "./formulaires";

export const metadata: Metadata = {
  title: "Sites et revues suivis",
  robots: { index: false, follow: false },
};

export default async function Sites({
  params,
  searchParams,
}: PageProps<"/[lang]/espace/bibliotheque/sites">) {
  const { lang } = await params;
  const { q } = await searchParams;
  const theme = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 80) ?? "";
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/bibliotheque`}>Retour à la bibliothèque</Retour>
      <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Globe className="h-6 w-6 text-red-600" aria-hidden />
        Sites et revues suivis
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        La liste des publications de chaque site est relue chaque jour : les nouvelles apparaissent en tête, marquées «
        Nouveau ». Ouvrez la version officielle (avec l&apos;accès abonné du cabinet si besoin), téléchargez le PDF puis
        ajoutez-le à la bibliothèque pour que l&apos;assistant puisse le citer. Seuls les titres et les liens sont
        relevés ; le contenu reste sur le site de l&apos;éditeur.
      </p>
      <Categories langue={lang} active="sites" />
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} theme={theme} />
      </Suspense>
    </div>
  );
}

const date = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" });

async function Contenu({ langue, theme }: { langue: string; theme: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let sites: SiteSuivi[] | null = null;
  try {
    sites = await listerSites();
  } catch (erreur) {
    console.error(erreur);
  }
  if (sites === null) return <ErreurLecture />;
  const suivis: SiteSuivi[] = sites;

  // Les sites pas relus depuis un jour le sont après l'affichage : les nouveautés apparaîtront à la visite suivante
  after(async () => {
    try {
      for (const id of await sitesARelire()) await verifierSite(id);
    } catch (erreur) {
      console.error(erreur);
    }
  });

  const proposes = Object.entries(SITES_PROPOSES).filter(([, p]) => !suivis.some((s) => s.adresse === p.adresse));
  // Recherche par thème (« fibrillation », « TAVI »…) dans les titres et résumés de toutes les publications suivies
  const mots = theme.toLowerCase().split(/\s+/).filter(Boolean);
  const correspond = (p: SiteSuivi["publications"][number]) =>
    mots.every((m) => `${p.titre} ${p.resume}`.toLowerCase().includes(m));
  const affiches = mots.length
    ? suivis
        .map((s) => ({ ...s, publications: s.publications.filter(correspond) }))
        .filter((s) => s.publications.length > 0)
    : suivis;
  const libelleType = (t: string) => typesSource.find((x) => x.cle === t)?.libelle ?? t;

  return (
    <>
      <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900">Suivre un site ou une revue</h2>
        {proposes
          .filter(([, p]) => p.groupe === "esc")
          .map(([cle, p]) => (
            <SuivreSitePropose key={cle} langue={langue} cle={cle} libelle={p.bouton} />
          ))}
        {proposes.some(([, p]) => p.groupe === "revue") && (
          <details open>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Revues cardio (flux RSS)</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {proposes
                .filter(([, p]) => p.groupe === "revue")
                .map(([cle, p]) => (
                  <SuivreSitePropose key={cle} langue={langue} cle={cle} libelle={p.bouton} />
                ))}
            </div>
          </details>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-slate-700">Autre site, revue ou flux RSS…</summary>
          <div className="mt-4">
            <FormulaireSite langue={langue} />
          </div>
        </details>
      </section>

      <form role="search" className="mt-6 flex gap-2">
        <label className="sr-only" htmlFor="theme">
          Chercher un thème dans les publications suivies
        </label>
        <input
          id="theme"
          name="q"
          defaultValue={theme}
          placeholder="Chercher un thème : fibrillation, TAVI, débat…"
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          <Search className="h-4 w-4" aria-hidden />
          Chercher
        </button>
      </form>
      {theme && affiches.length === 0 && <p className="mt-4 text-sm text-slate-500">Aucune publication ne correspond à « {theme} ».</p>}

      {affiches.length > 0 && (
        <div className="mt-8 flex justify-end">
          <ToutVerifier langue={langue} />
        </div>
      )}

      {affiches.map((site) => {
        const nouvelles = site.publications.filter((p) => p.nouvelle).length;
        const ajoutees = site.publications.filter((p) => p.importee).length;
        return (
          <section key={site.id} className="mt-4 rounded-2xl border border-slate-200 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">
                  {site.nom}
                  <a
                    href={site.adresse}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ms-2 inline-flex text-red-700"
                    aria-label="Ouvrir le site"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </h2>
                <p className="text-xs text-slate-500">
                  {[
                    libelleType(site.type),
                    site.langue === "en" ? "anglais" : "français",
                    `${site.publications.length} publication(s)`,
                    `${ajoutees} dans la bibliothèque`,
                    nouvelles ? `${nouvelles} nouvelle(s)` : "",
                    site.verifieLe ? `vérifié le ${date(site.verifieLe)}` : "jamais vérifié",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {site.erreur && (
                  <p role="alert" className="mt-1 text-xs text-red-700">
                    Dernière lecture impossible : {site.erreur}
                  </p>
                )}
              </div>
              <BoutonsSite langue={langue} id={site.id} nom={site.nom} />
            </div>

            <AccesAbonne
              langue={langue}
              id={site.id}
              accesUrl={site.accesUrl}
              identifiant={site.identifiant}
              motDePasse={site.motDePasse}
            />

            {site.publications.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                {site.publications.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-slate-900 hover:text-red-700 hover:underline"
                      >
                        {p.titre}
                      </a>
                      {p.media && (
                        <a
                          href={p.media}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ms-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 hover:bg-sky-200"
                        >
                          <Headphones className="h-3 w-3" aria-hidden />
                          Écouter
                        </a>
                      )}
                      {p.nouvelle && (
                        <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          Nouveau
                        </span>
                      )}
                      <p className="text-xs text-slate-500">
                        {p.publieLe ? `publié le ${date(p.publieLe)}` : `relevé le ${date(p.vueLe)}`}
                      </p>
                      {p.resume && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{p.resume}</p>}
                    </div>
                    {p.importee ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <BookCheck className="h-3.5 w-3.5" aria-hidden />
                        Dans la bibliothèque
                      </span>
                    ) : (
                      <Link
                        href={`/${langue}/espace/bibliotheque?publication=${p.id}#ajouter`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        <FilePlus2 className="h-3.5 w-3.5" aria-hidden />
                        Ajouter à la bibliothèque
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

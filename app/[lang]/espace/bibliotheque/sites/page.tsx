import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { after, connection } from "next/server";
import { BookCheck, ExternalLink, FileDown, FilePlus2, Globe, ShieldAlert } from "lucide-react";
import { estLangue } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { listerCopies, type CopieSite as Copie } from "../../../../dossier/copies";
import { compteDrive, driveConfigure } from "../../../../dossier/drive";
import { typesSource } from "../../../../dossier/sources";
import { listerSites, sitesARelire, verifierSite, type SiteSuivi } from "../../../../dossier/veille";
import { BaseNonConfiguree, ErreurLecture, Retour } from "../../patients/commun";
import { CopieSite, type ResumeCopie } from "./copie";
import { AccesAbonne, BoutonsSite, FormulaireSite, SuivreEsc, ToutVerifier } from "./formulaires";

export const metadata: Metadata = {
  title: "Sites et revues suivis",
  robots: { index: false, follow: false },
};

export default async function Sites({ params }: PageProps<"/[lang]/espace/bibliotheque/sites">) {
  const { lang } = await params;
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
        Nouveau ». Avec la <strong>copie privée</strong>, le site entier (pages HTML, images, PDF, diaporamas) est
        recopié dans le Google Drive du cabinet, pour votre usage personnel seulement, et son texte entre dans la
        bibliothèque. Un document que le site refuse de laisser copier (page protégée contre les robots) s&apos;ajoute à
        la main : ouvrez la version officielle, téléchargez le PDF, puis « Ajouter à la bibliothèque ».
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

const date = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" });

async function Contenu({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let sites: SiteSuivi[] | null = null;
  let copies: Copie[] = [];
  let driveConnecte = false;
  try {
    [sites, copies, driveConnecte] = await Promise.all([
      listerSites(),
      listerCopies(),
      driveConfigure() ? compteDrive().then(Boolean) : false,
    ]);
  } catch (erreur) {
    console.error(erreur);
  }
  if (sites === null) return <ErreurLecture />;

  // Les sites pas relus depuis un jour le sont après l'affichage : les nouveautés apparaîtront à la visite suivante
  after(async () => {
    try {
      for (const id of await sitesARelire()) await verifierSite(id);
    } catch (erreur) {
      console.error(erreur);
    }
  });

  const suitEsc = sites.some((s) => s.adresse.includes("escardio.org/guidelines/clinical-practice-guidelines"));
  const libelleType = (t: string) => typesSource.find((x) => x.cle === t)?.libelle ?? t;

  return (
    <>
      <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900">Suivre un site ou une revue</h2>
        {!suitEsc && <SuivreEsc langue={langue} />}
        <details>
          <summary className="cursor-pointer text-sm text-slate-700">Autre site, revue ou flux RSS…</summary>
          <div className="mt-4">
            <FormulaireSite langue={langue} />
          </div>
        </details>
      </section>

      {sites.length > 0 && (
        <div className="mt-8 flex justify-end">
          <ToutVerifier langue={langue} />
        </div>
      )}

      {sites.map((site) => {
        const nouvelles = site.publications.filter((p) => p.nouvelle).length;
        const ajoutees = site.publications.filter((p) => p.importee).length;
        const copiesSite = copies.filter((c) => c.siteId === site.id);
        const resume = resumer(site.copie, copiesSite);
        const liste = copiesSite.find((c) => c.profondeur === 0);
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

            <CopieSite langue={langue} id={site.id} nom={site.nom} resume={resume} driveConnecte={driveConnecte} />
            {liste && <LiensCopie copies={[liste, ...copiesSite.filter((c) => c.parentId === liste.id)]} />}

            <AccesAbonne
              langue={langue}
              id={site.id}
              accesUrl={site.accesUrl}
              identifiant={site.identifiant}
              motDePasse={site.motDePasse}
            />

            {site.publications.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                {site.publications.map((p) => {
                  const page = copiesSite.find((c) => c.publicationId === p.id && c.parentId === null);
                  const fichiers = page ? copiesSite.filter((c) => c.parentId === page.id) : [];
                  return (
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
                        {p.nouvelle && (
                          <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Nouveau
                          </span>
                        )}
                        <p className="text-xs text-slate-500">
                          {p.publieLe ? `publié le ${date(p.publieLe)}` : `relevé le ${date(p.vueLe)}`}
                        </p>
                        {page && <LiensCopie copies={[page, ...fichiers]} />}
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
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

function resumer(active: boolean, copies: Copie[]): ResumeCopie {
  const faites = copies.filter((c) => c.statut === "copiee");
  const derniere = faites.reduce<Date | null>((d, c) => (c.copieeLe && (!d || c.copieeLe > d) ? c.copieeLe : d), null);
  return {
    active,
    enFile: copies.filter((c) => c.statut === "a_copier" || c.statut === "en_cours").length,
    pages: faites.filter((c) => c.genre === "page").length,
    fichiers: faites.filter((c) => c.genre === "fichier").length,
    indexees: copies.filter((c) => c.indexee).length,
    bloquees: copies.filter((c) => c.statut === "bloquee").length,
    erreurs: copies.filter((c) => c.statut === "erreur").length,
    derniere: derniere ? date(derniere) : null,
  };
}

const taille = (octets: number) =>
  octets >= 1_000_000
    ? `${(octets / 1_000_000).toFixed(1).replace(".", ",")} Mo`
    : `${Math.max(1, Math.round(octets / 1000))} ko`;

// Liens vers la copie privée d'une page et de ses documents, ou raison pour laquelle elle manque
function LiensCopie({ copies }: { copies: Copie[] }) {
  const visibles = copies.filter((c) => c.statut !== "a_copier" && c.statut !== "en_cours");
  if (!visibles.length) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {visibles.map((c) =>
        c.statut === "copiee" ? (
          <li key={c.id}>
            <a
              href={`/api/bibliotheque/ouvrir/${c.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-800 hover:underline"
              title={c.titre}
            >
              <FileDown className="h-3 w-3" aria-hidden />
              {c.genre === "page" ? "Copie de la page" : c.titre.slice(0, 60)}
              <span className="text-slate-400">({taille(c.taille)})</span>
            </a>
          </li>
        ) : (
          <li key={c.id} className="inline-flex items-center gap-1 text-amber-800" title={c.erreur}>
            <ShieldAlert className="h-3 w-3" aria-hidden />
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {c.statut === "bloquee" ? "Copie refusée par le site" : "Copie impossible"}
              {c.profondeur > 1 && c.titre ? ` : ${c.titre.slice(0, 40)}` : ""}
            </a>
          </li>
        ),
      )}
    </ul>
  );
}

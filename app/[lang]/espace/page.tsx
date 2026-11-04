import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { Ban, CalendarDays, FilePen, FolderOpen, FolderPlus, Globe, Phone } from "lucide-react";
import { estLangue } from "../../cabinet";
import { ajouterJours, dateLocale, heureLocale, jourLocal } from "../../agenda/creneaux";
import { paramsPrefill } from "../../agenda/identite";
import { agendaConfigure, listerRendezvous, type Rendezvous } from "../../agenda/google";
import { utilisateurConnecte } from "../../agenda/session";
import { baseConfiguree } from "../../dossier/base";
import { correspondances, type Correspondance } from "../../dossier/rendez-vous";
import { BoutonAnnuler, BoutonRattacher, BoutonRouvrir, FormulaireAjout, FormulaireFermeture } from "./boutons";

export const metadata: Metadata = {
  title: "Espace cabinet",
  robots: { index: false, follow: false },
};

const JOURS_AFFICHES = 14;

export default async function Espace({ params }: PageProps<"/[lang]/espace">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Suspense fallback={<p className="text-slate-500">Chargement de l&apos;agenda…</p>}>
        <Tableau langue={lang} />
      </Suspense>
    </div>
  );
}

async function Tableau({ langue }: { langue: string }) {
  // Agenda en direct : jamais préchargé ni mis en cache
  await connection();
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect(`/${langue}/espace/connexion`);

  const aujourdhui = jourLocal(new Date());
  let rendezvous: Rendezvous[] | null = null;
  if (agendaConfigure()) {
    try {
      rendezvous = await listerRendezvous(
        dateLocale(aujourdhui, "00:00"),
        dateLocale(ajouterJours(aujourdhui, JOURS_AFFICHES), "00:00"),
      );
    } catch (erreur) {
      console.error(erreur);
    }
  }

  // Rendez-vous reliés aux dossiers : par le numéro de dossier noté dans l'événement, sinon dossier probable
  // (même téléphone, ou même nom, prénom et date de naissance) à confirmer par la secrétaire
  let dossiers = new Map<string, Correspondance>();
  if (baseConfiguree()) {
    try {
      dossiers = await correspondances((rendezvous ?? []).filter((r) => !r.fermeture));
    } catch (erreur) {
      console.error(erreur);
    }
  }

  // Regroupe par jour (les événements « journée entière » n'ont qu'une date)
  const parJour = new Map<string, Rendezvous[]>();
  for (const r of rendezvous ?? []) {
    const jour = r.debut.length === 10 ? r.debut : jourLocal(new Date(r.debut));
    parJour.set(jour, [...(parJour.get(jour) ?? []), r]);
  }
  const titreCourt = (jour: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${jour}T12:00:00Z`),
    );
  const titreJour = (jour: string) =>
    new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${jour}T12:00:00Z`),
    );

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Agenda du cabinet</h1>
      <p className="mt-1 text-sm text-slate-500">
        Connecté·e : <strong>{utilisateur.identifiant}</strong>
      </p>

      <section className="mt-8 rounded-2xl border border-slate-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Ajouter un rendez-vous</h2>
        <FormulaireAjout langue={langue} aujourdhui={aujourdhui} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Ban className="h-5 w-5 text-red-600" aria-hidden />
          Fermer des créneaux
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Congé, absence, formation… Les créneaux fermés ne sont plus proposés aux patients sur le site. Les
          rendez-vous déjà pris ne sont pas annulés.
        </p>
        <FormulaireFermeture langue={langue} aujourdhui={aujourdhui} />
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <CalendarDays className="h-5 w-5 text-red-600" aria-hidden />
          Les {JOURS_AFFICHES} prochains jours
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Tout événement ajouté directement dans Google Agenda bloque aussi les créneaux correspondants.
        </p>

        {rendezvous === null ? (
          <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            Impossible de lire l&apos;agenda Google. Vérifiez la configuration (voir RESERVATION.md).
          </p>
        ) : parJour.size === 0 ? (
          <p className="mt-6 text-slate-500">Aucun rendez-vous pour le moment.</p>
        ) : (
          <div className="mt-6 space-y-6">
            {[...parJour].map(([jour, liste]) => (
              <div key={jour}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 first-letter:capitalize">
                  {titreJour(jour)}
                </h3>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {liste.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="flex gap-4">
                        <span className="w-24 shrink-0 font-mono text-sm text-slate-700">
                          {r.debut.length === 10
                            ? ajouterJours(r.debut, 1) === r.fin
                              ? "Journée"
                              : `→ ${titreCourt(ajouterJours(r.fin, -1))}`
                            : `${heureLocale(new Date(r.debut))}–${heureLocale(new Date(r.fin))}`}
                        </span>
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">
                            {r.titre}
                            {r.fermeture && (
                              <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-normal text-red-700">
                                <Ban className="h-3 w-3" aria-hidden />
                                fermé
                              </span>
                            )}
                            {r.controle && (
                              <span className="ms-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-800">
                                contrôle
                              </span>
                            )}
                            {r.enLigne && (
                              <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-normal text-blue-700">
                                <Globe className="h-3 w-3" aria-hidden />
                                en ligne
                              </span>
                            )}
                          </p>
                          {r.telephone && (
                            <a
                              href={`tel:${r.telephone.replace(/[^\d+]/g, "")}`}
                              className="mt-1 inline-flex items-center gap-1 text-slate-600 hover:text-red-700"
                            >
                              <Phone className="h-3 w-3" aria-hidden />
                              {r.telephone}
                            </a>
                          )}
                          {!r.fermeture && (
                            <Dossier
                              langue={langue}
                              r={r}
                              correspondance={dossiers.get(r.id)}
                              baseActive={baseConfiguree()}
                            />
                          )}
                          {(r.dateNaissance || r.email) && (
                            <p className="mt-1 text-slate-500">
                              {r.dateNaissance && `Né·e le ${r.dateNaissance.split("-").reverse().join("/")}`}
                              {r.dateNaissance && r.email && " · "}
                              {r.email && (
                                <a href={`mailto:${r.email}`} className="hover:text-red-700">
                                  {r.email}
                                </a>
                              )}
                            </p>
                          )}
                          {r.motif && !r.fermeture && <p className="mt-1 text-slate-500">{r.motif}</p>}
                        </div>
                      </div>
                      {/* Rendez-vous patients et fermetures se gèrent ici ; le reste dans Google Agenda */}
                      {r.annulable && <BoutonAnnuler langue={langue} id={r.id} nom={r.titre} />}
                      {r.fermeture && <BoutonRouvrir langue={langue} id={r.id} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// Lien vers le dossier du patient, ou proposition pour la secrétaire quand le rendez-vous n'est pas encore rattaché
function Dossier({
  langue,
  r,
  correspondance,
  baseActive,
}: {
  langue: string;
  r: Rendezvous;
  correspondance: Correspondance | undefined;
  baseActive: boolean;
}) {
  if (!baseActive) return null;
  const lien = "inline-flex items-center gap-1 text-slate-600 hover:text-red-700";
  const prefill = paramsPrefill(r);
  const nom = (d: { nom: string; prenom: string }) => `${d.nom.toUpperCase()} ${d.prenom}`.trim();

  if (correspondance?.lien === "lie") {
    const d = correspondance.patient;
    return (
      <Link href={`/${langue}/espace/patients/${d.id}`} className={`mt-1 ms-3 ${lien}`}>
        <FolderOpen className="h-3 w-3" aria-hidden />
        Dossier de {nom(d)} · n° {d.id}
      </Link>
    );
  }

  if (correspondance) {
    const d = correspondance.patient;
    return (
      <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
        <p>
          {correspondance.lien === "telephone" ? "Même téléphone que le dossier de " : "Même nom, prénom et date de naissance que le dossier de "}
          <Link href={`/${langue}/espace/patients/${d.id}`} className="font-medium underline">
            {nom(d)}
          </Link>{" "}
          (n° {d.id}).
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <BoutonRattacher
            langue={langue}
            rdvId={r.id}
            patientId={d.id}
            apport={{ naissance: r.dateNaissance, email: r.email, telephone: r.telephone }}
            libelle="C'est le même patient"
          />
          <Link
            href={`/${langue}/espace/patients/nouveau?${new URLSearchParams([...paramsPrefill(r), ["rdv", r.id]])}`}
            className="text-amber-900 underline"
          >
            Non, créer un nouveau dossier
          </Link>
        </p>
        {((!d.naissance && r.dateNaissance) || (!d.email && r.email)) && (
          <p className="mt-1">
            Le patient a indiqué {[!d.naissance && r.dateNaissance && "sa date de naissance", !d.email && r.email && "son e-mail"].filter(Boolean).join(" et ")} : ajouté au dossier si vous rattachez.
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="mt-1 ms-3 inline-flex flex-wrap items-center gap-3">
      <Link
        href={`/${langue}/espace/patients/nouveau?${new URLSearchParams([...prefill, ["rdv", r.id]])}`}
        className={lien}
        title="Aucun dossier ne correspond : créer le dossier avec ce que le patient a déjà indiqué"
      >
        <FolderPlus className="h-3 w-3" aria-hidden />
        Créer le dossier
      </Link>
      <Link href={`/${langue}/espace/patients/fiche?${prefill}`} className={lien} target="_blank">
        <FilePen className="h-3 w-3" aria-hidden />
        Fiche papier
      </Link>
    </span>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { FileInput } from "lucide-react";
import { estLangue } from "../../../cabinet";
import { exigerUtilisateur } from "../../../agenda/session";
import { baseConfiguree } from "../../../dossier/base";
import { claudeConfigure } from "../../../dossier/dictee";
import { listerImports, type Import } from "../../../dossier/import-word";
import { BaseNonConfiguree, ErreurLecture } from "../patients/commun";
import { BoutonsImport, ChoixFichiers } from "./fichiers";

export const metadata: Metadata = {
  title: "Reprise des comptes rendus Word",
  robots: { index: false, follow: false },
};

export default async function Reprise({ params }: PageProps<"/[lang]/espace/reprise">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <FileInput className="h-6 w-6 text-red-600" aria-hidden />
        Reprise des comptes rendus Word
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Choisissez les anciens comptes rendus (rapports de consultation, échocardiographies), par exemple dans le
        dossier Google Drive de l&apos;ordinateur. L&apos;identité est lue sur place ; le reste du texte, sans le nom,
        la date de naissance ni les téléphones, est analysé pour proposer les visites, les valeurs et les traitements.
        Rien n&apos;entre dans les dossiers avant votre validation.
      </p>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

const statuts = { a_valider: "À valider", importe: "Importé", ignore: "Ignoré" };

async function Contenu({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;
  let imports: Import[] | null = null;
  try {
    imports = await listerImports();
  } catch (erreur) {
    console.error(erreur);
  }
  if (imports === null) return <ErreurLecture />;
  const aValider = imports.filter((i) => i.statut === "a_valider").length;

  return (
    <>
      <section className="mt-6 rounded-2xl border border-slate-200 p-6">
        {!claudeConfigure() && (
          <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Sans clé Anthropic (ANTHROPIC_API_KEY), seule l&apos;identité est lue automatiquement : le reste se remplit
            à la main d&apos;après le texte affiché.
          </p>
        )}
        <ChoixFichiers langue={langue} />
      </section>
      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">
          Comptes rendus lus <span className="font-normal text-slate-400">({aValider} à valider)</span>
        </h2>
        {imports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucun pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {imports.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {[i.identite.nom.toUpperCase(), i.identite.prenom].filter(Boolean).join(" ") || "Identité non lue"}
                    <span className="ms-2 font-normal text-slate-500">{i.nomFichier}</span>
                  </p>
                  <p className={`text-xs ${i.statut === "a_valider" ? "text-amber-700" : "text-slate-500"}`}>
                    {statuts[i.statut]}
                    {i.statut === "importe" && i.patientId && (
                      <>
                        {" · "}
                        <Link href={`/${langue}/espace/patients/${i.patientId}`} className="text-red-700 underline">
                          dossier n° {i.patientId}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {i.statut === "a_valider" && (
                    <Link
                      href={`/${langue}/espace/reprise/${i.id}`}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Vérifier et valider
                    </Link>
                  )}
                  <BoutonsImport langue={langue} id={i.id} aValider={i.statut === "a_valider"} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

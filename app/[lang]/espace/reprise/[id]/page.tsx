import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import { lireImport, propositionVide } from "../../../../dossier/import-word";
import {
  doublonsPossibles,
  facteursRisque,
  libellePatient,
  rechercherPatients,
  type ResumePatient,
} from "../../../../dossier/patients";
import { Retour } from "../../patients/commun";
import { FormulaireReprise } from "../validation";

export const metadata: Metadata = {
  title: "Valider un compte rendu repris",
  robots: { index: false, follow: false },
};

export default async function ValiderReprise({ params }: PageProps<"/[lang]/espace/reprise/[id]">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6" lang="fr" dir="ltr">
      <Retour href={`/${lang}/espace/reprise`}>Reprise des comptes rendus</Retour>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} params={params} />
      </Suspense>
    </div>
  );
}

async function Contenu({
  langue,
  params,
}: {
  langue: string;
  params: PageProps<"/[lang]/espace/reprise/[id]">["params"];
}) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  const id = Number((await params).id);
  const imp = Number.isInteger(id) && id > 0 ? await lireImport(id) : null;
  if (!imp) notFound();
  if (imp.statut !== "a_valider") redirect(`/${langue}/espace/reprise`);
  const { identite } = imp;

  // Dossiers qui pourraient être celui du patient : même nom et prénom (dans un ordre quelconque)
  const candidats = new Map<number, ResumePatient>();
  if (identite.nom || identite.prenom) {
    const recherche = `${identite.nom} ${identite.prenom}`.trim();
    for (const p of await rechercherPatients(recherche, 5)) candidats.set(p.id, p);
    if (identite.naissance) {
      const memes = await doublonsPossibles({
        nom: identite.nom,
        prenom: identite.prenom,
        naissance: identite.naissance,
        sexe: "",
        telephone: "",
        email: "",
        cin: "",
        adresse: "",
        couverture: "",
        medecinTraitant: "",
      });
      for (const p of memes) candidats.set(p.id, p);
    }
  }

  return (
    <>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Vérifier avant d&apos;importer</h1>
      <p className="mt-1 text-sm text-slate-500">
        {imp.nomFichier} · lu le{" "}
        {imp.creeLe.toLocaleString("fr-FR", { timeZone: "Africa/Casablanca", dateStyle: "short", timeStyle: "short" })}{" "}
        par {imp.creePar}. Corrigez si besoin en vous aidant du texte d&apos;origine, puis validez.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FormulaireReprise
          langue={langue}
          id={imp.id}
          identite={identite}
          proposition={imp.proposition ?? propositionVide(identite)}
          facteursRisque={facteursRisque}
          candidats={[...candidats.values()].map((p) => ({
            id: p.id,
            libelle: libellePatient(p),
            detail: [`n° ${p.id}`, p.naissance ? `né·e le ${p.naissance.split("-").reverse().join("/")}` : ""]
              .filter(Boolean)
              .join(", "),
          }))}
        />
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="font-semibold text-slate-900">Texte d&apos;origine</h2>
          <pre className="mt-2 max-h-[80vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 font-sans text-xs leading-5 text-slate-700">
            {imp.texte}
          </pre>
        </aside>
      </div>
    </>
  );
}

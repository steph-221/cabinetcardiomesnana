import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { estLangue } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { listerActes, listerPraticiens, miseEnCommun } from "../../../../dossier/compta";
import { BaseNonConfiguree, ErreurLecture } from "../../patients/commun";
import { FormulaireActe, FormulairePraticien, InterrupteurPartage } from "../formulaires";

export const metadata: Metadata = {
  title: "Réglages de la comptabilité",
  robots: { index: false, follow: false },
};

export default async function Reglages({ params }: PageProps<"/[lang]/espace/comptabilite/reglages">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6" lang="fr" dir="ltr">
      <h1 className="text-2xl font-bold text-slate-900">Réglages de la comptabilité</h1>
      <Suspense fallback={<p className="mt-8 text-slate-500">Chargement…</p>}>
        <Contenu langue={lang} />
      </Suspense>
    </div>
  );
}

async function Contenu({ langue }: { langue: string }) {
  await connection();
  await exigerUtilisateur(langue, "medical");
  if (!baseConfiguree()) return <BaseNonConfiguree />;

  let donnees: { praticiens: Awaited<ReturnType<typeof listerPraticiens>>; actes: Awaited<ReturnType<typeof listerActes>>; commun: boolean } | null = null;
  try {
    const [praticiens, actes, commun] = await Promise.all([listerPraticiens(), listerActes(), miseEnCommun()]);
    donnees = { praticiens, actes, commun };
  } catch (erreur) {
    console.error(erreur);
  }
  if (!donnees) return <ErreurLecture />;
  const { praticiens, actes, commun } = donnees;

  return (
    <>
      <section className="mt-8 rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Médecins du cabinet</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          La <strong>part</strong> sert à partager les charges communes (50 / 50 pour deux associés à égalité). Si vous
          indiquez l&apos;<strong>identifiant de connexion</strong> du médecin, c&apos;est lui qui est présélectionné quand il
          établit une facture.
        </p>
        <div className="space-y-4">
          {praticiens.map((p) => (
            <FormulairePraticien key={`${p.id}-${p.nom}-${p.part}-${p.actif}`} langue={langue} praticien={p} />
          ))}
        </div>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <FormulairePraticien key={praticiens.length} langue={langue} praticien={null} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Partage des honoraires</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          {commun
            ? "Actuellement, le résultat du cabinet est mis en commun : les honoraires encaissés par l'un et l'autre forment un pot, partagé selon les parts, après les charges."
            : "Actuellement, chaque médecin garde les honoraires de ses propres actes ; seules les charges communes sont partagées selon les parts."}
        </p>
        <InterrupteurPartage langue={langue} actif={commun} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Tarifs des actes</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Proposés comme raccourcis dans le formulaire de facture. Les montants de départ sont indicatifs : ajustez-les
          à vos honoraires. Modifier un tarif ne change pas les factures déjà établies.
        </p>
        <div className="space-y-3">
          {actes.map((a) => (
            <FormulaireActe key={`${a.id}-${a.libelle}-${a.tarifCts}`} langue={langue} acte={a} />
          ))}
        </div>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <FormulaireActe key={actes.length} langue={langue} acte={null} />
        </div>
      </section>
    </>
  );
}

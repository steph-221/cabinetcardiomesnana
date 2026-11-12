import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { estLangue, cabinet } from "../../../../cabinet";
import { exigerUtilisateur } from "../../../../agenda/session";
import { baseConfiguree } from "../../../../dossier/base";
import { journaliser } from "../../../../dossier/journal";
import { couvertures, facteursRisque, libellePatient, lirePatient } from "../../../../dossier/patients";
import { Retour } from "../commun";
import { BoutonImprimer } from "./imprimer";

export const metadata: Metadata = {
  title: "Fiche patient à remplir",
  robots: { index: false, follow: false },
};

export default async function FichePapier({ params, searchParams }: PageProps<"/[lang]/espace/patients/fiche">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  return (
    <Suspense fallback={<p className="p-8 text-slate-500">Chargement…</p>}>
      <Fiche langue={lang} searchParams={searchParams} />
    </Suspense>
  );
}

const jj = (naissance: string) => naissance.split("-").reverse().join("/");

// Ligne à compléter à la main, ou valeur déjà connue (imprimée en gras)
function Ligne({ libelle, valeur, className = "" }: { libelle: string; valeur?: string; className?: string }) {
  return (
    <div className={`flex items-end gap-2 border-b border-slate-400 pb-0.5 ${className}`}>
      <span className="shrink-0 text-xs text-slate-600">{libelle}</span>
      <span className="min-h-6 flex-1 font-semibold text-slate-900">{valeur}</span>
    </div>
  );
}

function Case({ libelle, cochee = false }: { libelle: string; cochee?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="inline-flex h-4 w-4 items-center justify-center border border-slate-700 text-xs leading-none">
        {cochee ? "✕" : ""}
      </span>
      {libelle}
    </span>
  );
}

async function Fiche({
  langue,
  searchParams,
}: {
  langue: string;
  searchParams: PageProps<"/[lang]/espace/patients/fiche">["searchParams"];
}) {
  await connection();
  const utilisateur = await exigerUtilisateur(langue);
  const q = await searchParams;
  const lire = (cle: string) => (typeof q[cle] === "string" ? (q[cle] as string).slice(0, 300) : "");

  // Patient déjà suivi : on imprime son identité pour qu'il la vérifie et la corrige. Le contenu médical
  // n'est jamais prérempli (la secrétaire n'y a pas accès).
  let v = {
    nom: lire("nom"),
    prenom: lire("prenom"),
    telephone: lire("telephone"),
    naissance: lire("naissance"),
    email: lire("email"),
    sexe: "",
    cin: "",
    adresse: "",
    couverture: "",
    medecinTraitant: "",
    langue: "",
  };
  let dossier = "";
  const id = Number(lire("patient"));
  if (Number.isInteger(id) && id > 0 && baseConfiguree()) {
    const p = await lirePatient(id).catch(() => null);
    if (p) {
      v = { ...v, ...p, naissance: p.naissance ?? "" };
      dossier = `Dossier n° ${p.id}`;
      await journaliser(utilisateur.identifiant, "fiche papier imprimée", p.id, libellePatient(p)).catch(console.error);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" lang="fr" dir="ltr">
      {/* À l'impression : seule la fiche est imprimée, sur une page A4 */}
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          header, footer, nav[aria-label="Espaces du cabinet"], .sans-impression { display: none !important; }
          div:has(> nav[aria-label="Espaces du cabinet"]) { display: none !important; }
          body { background: white; }
          .fiche { padding: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="sans-impression mb-6 flex flex-wrap items-center justify-between gap-3">
        <Retour href={`/${langue}/espace/patients`}>Patients</Retour>
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">
            {dossier ? "Identité reprise du dossier : à faire vérifier." : "À donner au patient, sur papier."}
          </p>
          <BoutonImprimer />
        </div>
      </div>

      <article className="fiche space-y-5 text-slate-900">
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
          <div>
            <h1 className="text-lg font-bold">{cabinet.medecin}</h1>
            <p className="text-sm">{cabinet.specialite} — Cabinet de cardiologie Mesnana</p>
            <p className="text-xs text-slate-600">
              {cabinet.adresse.rue}, {cabinet.adresse.ville} · {cabinet.telephones.fixe.numero}
            </p>
          </div>
          <p className="text-end text-sm font-semibold">
            Fiche de renseignements
            {dossier && <span className="block font-normal text-slate-600">{dossier}</span>}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">Votre identité</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Ligne libelle="Nom" valeur={v.nom.toUpperCase()} />
            <Ligne libelle="Prénom" valeur={v.prenom} />
            <div className="flex items-end gap-4 pb-0.5">
              <span className="text-xs text-slate-600">Sexe</span>
              <Case libelle="Femme" cochee={v.sexe === "F"} />
              <Case libelle="Homme" cochee={v.sexe === "M"} />
            </div>
            <Ligne libelle="Date de naissance (jj/mm/aaaa)" valeur={v.naissance ? jj(v.naissance) : ""} />
            <Ligne libelle="N° de CIN" valeur={v.cin} />
            <Ligne libelle="Téléphone" valeur={v.telephone} />
            <Ligne libelle="E-mail" valeur={v.email} className="col-span-2" />
            <Ligne libelle="Adresse" valeur={v.adresse} className="col-span-2" />
            <Ligne libelle="Médecin traitant" valeur={v.medecinTraitant} className="col-span-2" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs text-slate-600">Couverture médicale</span>
            {couvertures.map((c) => (
              <Case key={c} libelle={c} cochee={v.couverture.toLowerCase() === c.toLowerCase()} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide">Votre santé</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs text-slate-600">Vous avez :</span>
            {facteursRisque.map((f) => (
              <Case key={f} libelle={f} />
            ))}
          </div>
          <Ligne libelle="Motif de la consultation" />
          <Ligne libelle="" />
          <Ligne libelle="Allergies ou intolérances (médicaments, aliments…)" />
          <Ligne libelle="Maladies et opérations passées" />
          <Ligne libelle="" />
          <Ligne libelle="Médicaments pris actuellement (nom et dose)" />
          <Ligne libelle="" />
          <Ligne libelle="" />
          <div className="grid grid-cols-3 gap-x-6">
            <Ligne libelle="Poids (kg)" />
            <Ligne libelle="Taille (cm)" />
            <div className="flex items-end gap-3 pb-0.5">
              <span className="text-xs text-slate-600">Tabac</span>
              <Case libelle="Non" />
              <Case libelle="Oui" />
              <Case libelle="Ancien" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-x-6 pt-2">
          <Ligne libelle="Date" />
          <Ligne libelle="Signature" />
        </section>
        <p className="text-xs text-slate-500">
          Ces informations sont réservées au cabinet ; elles servent uniquement à votre suivi médical et vous pouvez
          les consulter ou les faire rectifier à tout moment (loi n° 09-08).
        </p>
      </article>
    </div>
  );
}

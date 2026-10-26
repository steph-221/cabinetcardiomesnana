"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Plus, Save, Square, Trash2 } from "lucide-react";
import type { Patient } from "../../../dossier/patients";
import {
  arreter,
  effacerTraitement,
  enregistrerPatient,
  nouveauTraitement,
  supprimer,
  type EtatPatient,
} from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-sm font-medium text-slate-700";
const decimalFr = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

function Envoyer({
  children,
  className,
  confirmation,
}: {
  children: React.ReactNode;
  className: string;
  confirmation?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:opacity-50`}
      onClick={(e) => {
        if (confirmation && !confirm(confirmation)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

// Création et modification d'un dossier. Sans accès médical, seule l'identité est affichée.
export function FormulairePatient({
  langue,
  patient,
  medical,
  facteurs,
  couvertures,
  aujourdhui,
}: {
  langue: string;
  patient: Patient | null;
  medical: boolean;
  facteurs: readonly string[];
  couvertures: string[];
  aujourdhui: string;
}) {
  const [etat, envoyer] = useActionState<EtatPatient, FormData>(
    enregistrerPatient.bind(null, langue, patient?.id ?? null),
    null,
  );
  // Après une erreur, on réaffiche ce qui a été saisi ; sinon le dossier existant
  const v = (nom: string, initial: string | null | undefined) => (etat ? etat.valeurs[nom] : initial) ?? "";
  const facteursCoches = etat ? (etat.valeurs.facteursRisque ?? "").split("|") : (patient?.facteursRisque ?? []);

  return (
    <form action={envoyer} className="space-y-8">
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-lg font-semibold text-slate-900">Identité</legend>
        <label className={etiquette}>
          Nom
          <input name="nom" required maxLength={100} defaultValue={v("nom", patient?.nom)} className={champ} />
        </label>
        <label className={etiquette}>
          Prénom
          <input name="prenom" maxLength={100} defaultValue={v("prenom", patient?.prenom)} className={champ} />
        </label>
        <label className={etiquette}>
          Sexe
          <select name="sexe" defaultValue={v("sexe", patient?.sexe)} className={champ}>
            <option value="">—</option>
            <option value="F">Femme</option>
            <option value="M">Homme</option>
          </select>
        </label>
        <label className={etiquette}>
          Date de naissance
          <input
            name="naissance"
            type="date"
            min="1900-01-01"
            max={aujourdhui}
            defaultValue={v("naissance", patient?.naissance)}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          Téléphone
          <input
            name="telephone"
            type="tel"
            maxLength={30}
            defaultValue={v("telephone", patient?.telephone)}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          E-mail
          <input name="email" type="email" maxLength={100} defaultValue={v("email", patient?.email)} className={champ} />
        </label>
        <label className={etiquette}>
          CIN
          <input name="cin" maxLength={20} defaultValue={v("cin", patient?.cin)} className={champ} />
        </label>
        <label className={etiquette}>
          Couverture
          <input
            name="couverture"
            list="couvertures"
            maxLength={100}
            defaultValue={v("couverture", patient?.couverture)}
            className={champ}
          />
          <datalist id="couvertures">
            {couvertures.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className={etiquette}>
          Médecin traitant
          <input
            name="medecinTraitant"
            maxLength={100}
            defaultValue={v("medecinTraitant", patient?.medecinTraitant)}
            className={champ}
          />
        </label>
        <label className={`${etiquette} sm:col-span-2 lg:col-span-3`}>
          Adresse
          <input name="adresse" maxLength={300} defaultValue={v("adresse", patient?.adresse)} className={champ} />
        </label>
      </fieldset>

      {medical && (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-3 text-lg font-semibold text-slate-900">Médical</legend>
          <div className="sm:col-span-2">
            <p className={etiquette}>Facteurs de risque cardiovasculaire</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {facteurs.map((f) => (
                <label
                  key={f}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 has-checked:border-red-500 has-checked:bg-red-50 has-checked:text-red-800"
                >
                  <input
                    type="checkbox"
                    name="facteursRisque"
                    value={f}
                    defaultChecked={facteursCoches.includes(f)}
                    className="accent-red-600"
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>
          <label className={`${etiquette} sm:col-span-2`}>
            Allergies et intolérances
            <input
              name="allergies"
              maxLength={1000}
              placeholder="Aucune connue"
              defaultValue={v("allergies", patient?.allergies)}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Antécédents
            <textarea
              name="antecedents"
              rows={5}
              maxLength={5000}
              placeholder="RVAo mécanique (mai 2024), ACFA…"
              defaultValue={v("antecedents", patient?.antecedents)}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Notes
            <textarea name="notes" rows={5} maxLength={5000} defaultValue={v("notes", patient?.notes)} className={champ} />
          </label>
          <div className="sm:col-span-2">
            <p className={etiquette}>
              Zone cible de l&apos;INR{" "}
              <span className="font-normal text-slate-400">(si traitement par AVK : alerte quand l&apos;INR en sort)</span>
            </p>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <input
                name="inrMin"
                inputMode="decimal"
                aria-label="INR minimum"
                placeholder="2,5"
                defaultValue={v("inrMin", decimalFr(patient?.inrMin))}
                className={`${champ} mt-0 w-24`}
              />
              à
              <input
                name="inrMax"
                inputMode="decimal"
                aria-label="INR maximum"
                placeholder="3,5"
                defaultValue={v("inrMax", decimalFr(patient?.inrMax))}
                className={`${champ} mt-0 w-24`}
              />
            </div>
          </div>
        </fieldset>
      )}

      {etat && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
          <p>{etat.erreur}</p>
          {etat.doublons && (
            <>
              <ul className="mt-2 list-disc ps-5">
                {etat.doublons.map((d) => (
                  <li key={d.id}>
                    <Link href={`/${langue}/espace/patients/${d.id}`} className="font-medium underline">
                      {d.libelle} — n° {d.id}
                    </Link>
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex items-center gap-2">
                <input type="checkbox" name="confirmerDoublon" className="accent-red-600" />
                Créer quand même un nouveau dossier
              </label>
            </>
          )}
        </div>
      )}

      <Envoyer className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
        <Save className="h-4 w-4" aria-hidden />
        {patient ? "Enregistrer les modifications" : "Créer le dossier"}
      </Envoyer>
    </form>
  );
}

export function FormulaireTraitement({ langue, patientId }: { langue: string; patientId: number }) {
  const [etat, envoyer] = useActionState(nouveauTraitement.bind(null, langue, patientId), null);
  const v = etat?.valeurs ?? {};

  return (
    <form action={envoyer} className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
      <label className={etiquette}>
        Médicament
        <input
          name="medicament"
          required
          maxLength={150}
          placeholder="Bisoprolol 2,5 mg"
          defaultValue={v.medicament}
          className={champ}
        />
      </label>
      <label className={etiquette}>
        Posologie
        <input name="posologie" maxLength={300} placeholder="1 cp le matin" defaultValue={v.posologie} className={champ} />
      </label>
      <label className={etiquette}>
        Depuis le
        <input name="debut" type="date" defaultValue={v.debut} className={champ} />
      </label>
      <Envoyer className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        <Plus className="h-4 w-4" aria-hidden />
        Ajouter
      </Envoyer>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-4">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}

export function BoutonsTraitement({
  langue,
  patientId,
  id,
  enCours,
  medicament,
}: {
  langue: string;
  patientId: number;
  id: number;
  enCours: boolean;
  medicament: string;
}) {
  return (
    <div className="flex gap-1">
      {enCours && (
        <form action={arreter.bind(null, langue, patientId, id)}>
          <Envoyer
            confirmation={`Arrêter ${medicament} à partir d'aujourd'hui ?`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            <Square className="h-3 w-3" aria-hidden />
            Arrêter
          </Envoyer>
        </form>
      )}
      <form action={effacerTraitement.bind(null, langue, patientId, id)}>
        <Envoyer
          confirmation={`Supprimer la ligne « ${medicament} » ? (erreur de saisie : pour un arrêt, utilisez « Arrêter »)`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          Supprimer
        </Envoyer>
      </form>
    </div>
  );
}

export function BoutonSupprimerPatient({ langue, id, nom }: { langue: string; id: number; nom: string }) {
  return (
    <form action={supprimer.bind(null, langue, id)}>
      <Envoyer
        confirmation={`Supprimer définitivement le dossier de ${nom} et tout son contenu ? Cette action est irréversible.`}
        className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Supprimer le dossier
      </Envoyer>
    </form>
  );
}

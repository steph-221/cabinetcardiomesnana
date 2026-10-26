"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, TriangleAlert } from "lucide-react";
import { champsETT } from "../../../dossier/ett";
import type { Proposition } from "../../../dossier/import-word";
import { mesures } from "../../../dossier/mesures";
import type { IdentiteLue } from "../../../dossier/reprise";
import { validerImport } from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-xs font-medium text-slate-600";
const section = "rounded-2xl border border-slate-200 p-5";

type Candidat = { id: number; libelle: string; detail: string };

function Valider({ nouveau }: { nouveau: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
    >
      <Check className="h-4 w-4" aria-hidden />
      {pending ? "Enregistrement…" : nouveau ? "Valider et créer le dossier" : "Valider et compléter le dossier"}
    </button>
  );
}

const constantes = [
  { cle: "taSys", libelle: "TA sys." },
  { cle: "taDia", libelle: "TA dia." },
  { cle: "fc", libelle: "FC" },
  { cle: "spo2", libelle: "SpO₂ %" },
  { cle: "poids", libelle: "Poids kg" },
  { cle: "taille", libelle: "Taille cm" },
] as const;

const rubriques = [
  { cle: "motif", libelle: "Motif" },
  { cle: "examen", libelle: "Examen clinique" },
  { cle: "ecg", libelle: "ECG" },
  { cle: "autres", libelle: "Autres (biologie, examens)" },
  { cle: "conclusion", libelle: "Conclusion" },
  { cle: "conduite", libelle: "Conduite à tenir" },
] as const;

export function FormulaireReprise({
  langue,
  id,
  identite,
  proposition: p,
  candidats,
  facteursRisque,
}: {
  facteursRisque: readonly string[];
  langue: string;
  id: number;
  identite: IdentiteLue;
  proposition: Proposition;
  candidats: Candidat[];
}) {
  const [etat, envoyer] = useActionState(validerImport.bind(null, langue, id), null);
  // Après une erreur, le formulaire reprend la saisie ; sinon la proposition
  const v = (nom: string, defaut: string | number | null | undefined) =>
    etat ? (etat.valeurs[nom] ?? "") : defaut === null || defaut === undefined ? "" : String(defaut);
  const coche = (nom: string, defaut: boolean) => (etat ? etat.valeurs[nom] === "on" : defaut);
  const [cible, setCible] = useState("nouveau");

  return (
    <form action={envoyer} className="space-y-5">
      {p.aVerifier.length > 0 && (
        <div role="note" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" aria-hidden />À vérifier
          </p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {p.aVerifier.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className={section}>
        <legend className="px-1 font-semibold text-slate-900">Dossier</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="cible"
            value="nouveau"
            checked={cible === "nouveau"}
            onChange={() => setCible("nouveau")}
          />
          Créer un nouveau dossier
        </label>
        {candidats.map((c) => (
          <label key={c.id} className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="cible"
              value={c.id}
              checked={cible === String(c.id)}
              onChange={() => setCible(String(c.id))}
            />
            <span>
              Compléter le dossier existant de <span className="font-medium">{c.libelle}</span>
              <span className="ms-1 text-slate-500">{c.detail}</span>
            </span>
          </label>
        ))}
        {candidats.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Un dossier existant est complété sans rien effacer : son identité ne change pas.
          </p>
        )}
      </fieldset>

      <fieldset className={section}>
        <legend className="px-1 font-semibold text-slate-900">Identité</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={etiquette}>
            Nom
            <input name="nom" maxLength={100} defaultValue={v("nom", identite.nom)} className={champ} />
          </label>
          <label className={etiquette}>
            Prénom
            <input name="prenom" maxLength={100} defaultValue={v("prenom", identite.prenom)} className={champ} />
          </label>
          <label className={etiquette}>
            Sexe
            <select name="sexe" defaultValue={v("sexe", p.sexe)} className={champ}>
              <option value="">Non renseigné</option>
              <option value="F">Femme</option>
              <option value="M">Homme</option>
            </select>
          </label>
          <label className={etiquette}>
            Date de naissance
            <input name="naissance" type="date" defaultValue={v("naissance", identite.naissance)} className={champ} />
            {!identite.naissance && identite.age !== null && (
              <span className="mt-1 block font-normal text-slate-500">
                {identite.age} ans
                {identite.dateDocument ? ` le ${identite.dateDocument.split("-").reverse().join("/")}` : ""}{" "}
                d&apos;après le compte rendu
                {identite.dateDocument
                  ? ` (né·e en ${Number(identite.dateDocument.slice(0, 4)) - identite.age - 1} ou ${Number(identite.dateDocument.slice(0, 4)) - identite.age})`
                  : ""}
              </span>
            )}
          </label>
          <label className={etiquette}>
            Téléphone
            <input name="telephone" maxLength={30} defaultValue={v("telephone", "")} className={champ} />
          </label>
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="px-1 font-semibold text-slate-900">Antécédents et facteurs de risque</legend>
        <label className={etiquette}>
          Antécédents
          <textarea name="antecedents" rows={2} defaultValue={v("antecedents", p.antecedents)} className={champ} />
        </label>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {facteursRisque.map((f, i) => (
            <label key={f} className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                name={`fdr_${i}`}
                defaultChecked={coche(`fdr_${i}`, p.facteursRisque.includes(f))}
              />
              {f}
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label className={etiquette}>
            Allergies
            <input name="allergies" defaultValue={v("allergies", p.allergies)} className={champ} />
          </label>
          <label className={etiquette}>
            INR cible min.
            <input name="inrMin" inputMode="decimal" defaultValue={v("inrMin", p.inrMin)} className={champ} />
          </label>
          <label className={etiquette}>
            INR cible max.
            <input name="inrMax" inputMode="decimal" defaultValue={v("inrMax", p.inrMax)} className={champ} />
          </label>
        </div>
      </fieldset>

      <fieldset className={section}>
        <legend className="px-1 font-semibold text-slate-900">Traitements</legend>
        <input type="hidden" name="nbTraitements" value={p.traitements.length} />
        {p.traitements.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun traitement repéré.</p>
        ) : (
          <div className="space-y-2">
            {p.traitements.map((t, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[auto_1fr_1.5fr_auto]">
                <label className="inline-flex items-center gap-1.5 pb-2 text-xs text-slate-600">
                  <input type="checkbox" name={`t${i}_garder`} defaultChecked={coche(`t${i}_garder`, true)} />
                  Garder
                </label>
                <label className={etiquette}>
                  Médicament
                  <input
                    name={`t${i}_medicament`}
                    defaultValue={v(`t${i}_medicament`, t.medicament)}
                    className={champ}
                  />
                </label>
                <label className={etiquette}>
                  Posologie
                  <input name={`t${i}_posologie`} defaultValue={v(`t${i}_posologie`, t.posologie)} className={champ} />
                </label>
                <label className="inline-flex items-center gap-1.5 pb-2 text-xs text-slate-600">
                  <input type="checkbox" name={`t${i}_arrete`} defaultChecked={coche(`t${i}_arrete`, t.arrete)} />
                  Arrêté
                </label>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <input type="hidden" name="nbVisites" value={p.visites.length} />
      {p.visites.map((visite, i) => (
        <fieldset key={i} className={section}>
          <legend className="px-1 font-semibold text-slate-900">
            Visite {i + 1}
            {visite.date ? ` du ${visite.date.split("-").reverse().join("/")}` : ""}
          </legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className="inline-flex items-center gap-1.5 pb-2 text-sm">
              <input type="checkbox" name={`v${i}_garder`} defaultChecked={coche(`v${i}_garder`, true)} />
              Importer cette visite
            </label>
            <label className={etiquette}>
              Date
              <input name={`v${i}_date`} type="date" defaultValue={v(`v${i}_date`, visite.date)} className={champ} />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {constantes.map((c) => (
              <label key={c.cle} className={etiquette}>
                {c.libelle}
                <input
                  name={`v${i}_${c.cle}`}
                  inputMode="decimal"
                  defaultValue={v(`v${i}_${c.cle}`, visite[c.cle])}
                  className={champ}
                />
              </label>
            ))}
            {mesures.map((m) => (
              <label key={m.cle} className={etiquette}>
                {m.libelle}
                {m.unite ? ` ${m.unite}` : ""}
                <input
                  name={`v${i}_${m.cle}`}
                  inputMode="decimal"
                  defaultValue={v(`v${i}_${m.cle}`, visite.mesures[m.cle])}
                  className={champ}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {rubriques.map((r) => (
              <label key={r.cle} className={etiquette}>
                {r.libelle}
                <textarea
                  name={`v${i}_${r.cle}`}
                  rows={2}
                  defaultValue={v(`v${i}_${r.cle}`, visite[r.cle])}
                  className={champ}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {p.ett && (
        <fieldset className={section}>
          <legend className="px-1 font-semibold text-slate-900">Échocardiographie (ETT)</legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className="inline-flex items-center gap-1.5 pb-2 text-sm">
              <input type="checkbox" name="ett_garder" defaultChecked={coche("ett_garder", true)} />
              Importer l&apos;ETT
            </label>
            <label className={etiquette}>
              Date
              <input
                name="ett_date"
                type="date"
                defaultValue={v("ett_date", p.ett.date ?? identite.dateDocument)}
                className={champ}
              />
            </label>
            <label className={`${etiquette} min-w-48 flex-1`}>
              Indication
              <input name="ett_indication" defaultValue={v("ett_indication", p.ett.indication)} className={champ} />
            </label>
            <label className={`${etiquette} min-w-48 flex-1`}>
              Opérateur
              <input name="ett_operateur" defaultValue={v("ett_operateur", p.ett.operateur)} className={champ} />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {champsETT.map((c) => (
              <label key={c.cle} className={`${etiquette} ${c.texte ? "col-span-2" : ""}`}>
                {c.libelle}
                {c.unite ? ` (${c.unite})` : ""}
                <input
                  name={`ett_${c.cle}`}
                  inputMode={c.texte ? undefined : "decimal"}
                  defaultValue={v(`ett_${c.cle}`, p.ett!.valeurs[c.cle])}
                  className={champ}
                />
              </label>
            ))}
          </div>
          <label className={`${etiquette} mt-3 block`}>
            AU TOTAL
            <textarea name="ett_total" rows={5} defaultValue={v("ett_total", p.ett.total)} className={champ} />
          </label>
        </fieldset>
      )}

      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}
      <Valider nouveau={cible === "nouveau"} />
    </form>
  );
}

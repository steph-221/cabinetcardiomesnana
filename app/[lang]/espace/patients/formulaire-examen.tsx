"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileCheck, Plus } from "lucide-react";
import { trouverModele } from "../../../dossier/comptes-rendus";
import { ajouterProposition, referencesCitees } from "../../../dossier/comptes-rendus/references";
import { avecSeuils } from "../../../dossier/comptes-rendus/references-propositions";
import type { ReferenceSeuil } from "../../../dossier/comptes-rendus/seuils";
import { champs, type ChampExamen, type ValeursExamen } from "../../../dossier/comptes-rendus/types";
import { nouveauCompteRenduExamen } from "./actions-documents";
import { LigneReference } from "./reference-seuil";
import { ChoixConsultation } from "./choix-consultation";
import type { OptionConsultation } from "../../../dossier/choix-consultation";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-sm font-medium text-slate-700";

function Envoyer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      <FileCheck className="h-4 w-4" aria-hidden />
      Enregistrer le compte rendu
    </button>
  );
}

// Seul l'identifiant du modèle passe du serveur au navigateur : le modèle (avec ses fonctions) est retrouvé ici
export function FormulaireExamen({
  langue,
  patientId,
  cle,
  sexe,
  age,
  operateur,
  aujourdhui,
  references,
  consultations,
  consultationDefaut,
}: {
  langue: string;
  patientId: number;
  cle: string;
  sexe: "" | "F" | "M";
  age: number | null;
  operateur: string;
  aujourdhui: string;
  references: Record<string, ReferenceSeuil>;
  consultations: OptionConsultation[];
  consultationDefaut?: number;
}) {
  const modele = trouverModele(cle);
  const [etat, envoyer] = useActionState(nouveauCompteRenduExamen.bind(null, langue, patientId, cle), null);
  const v = (nom: string, initial = "") => (etat ? etat.valeurs[nom] : initial) ?? "";
  const formulaire = useRef<HTMLFormElement>(null);
  const [saisie, setSaisie] = useState<ValeursExamen>({});
  const [total, setTotal] = useState(v("total"));
  const [utilisees, setUtilisees] = useState<string[]>([]);
  if (!modele) return <p className="text-red-700">Modèle de compte rendu inconnu.</p>;

  const contexte = { age, sexe };
  const calculs = modele.calculs(saisie, contexte);
  const propositions = avecSeuils(modele.cle, modele.propositions(saisie, contexte));
  // Chaque proposition ajoutée porte le repère de ses références, citées en bas du compte rendu
  const ajouter = (p: { texte: string; seuils: string[] }) => {
    const r = ajouterProposition(total, utilisees, p);
    setTotal(r.total);
    setUtilisees(r.utilisees);
  };
  const citees = referencesCitees(total, utilisees, references);

  function lire() {
    if (!formulaire.current || !modele) return;
    const donnees = new FormData(formulaire.current);
    const valeurs: ValeursExamen = {};
    for (const c of champs(modele)) {
      const brut = String(donnees.get(c.cle) ?? "").trim();
      if (!brut) continue;
      if (c.type === "nombre") {
        const n = Number(brut.replace(",", "."));
        if (Number.isFinite(n)) valeurs[c.cle] = n;
      } else valeurs[c.cle] = brut;
    }
    setSaisie(valeurs);
  }

  const zone = (c: ChampExamen) => (
    <label key={c.cle} className={`${etiquette} ${c.type === "texte" ? "col-span-2" : ""}`}>
      {c.libelle} {c.unite && <span className="font-normal text-slate-400">({c.unite})</span>}
      {c.type === "choix" ? (
        <select name={c.cle} defaultValue={v(c.cle)} className={champ}>
          <option value=""></option>
          {c.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          name={c.cle}
          inputMode={c.type === "nombre" ? "decimal" : undefined}
          maxLength={c.type === "nombre" ? 10 : 300}
          placeholder={c.exemple}
          defaultValue={v(c.cle)}
          className={champ}
        />
      )}
    </label>
  );

  return (
    <form ref={formulaire} action={envoyer} onChange={lire} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={etiquette}>
          Date
          <input name="date" type="date" required max={aujourdhui} defaultValue={v("date", aujourdhui)} className={champ} />
        </label>
        <label className={`${etiquette} sm:col-span-2`}>
          Indication
          <input name="indication" maxLength={300} defaultValue={v("indication")} className={champ} />
        </label>
        <label className={etiquette}>
          Opérateur
          <input name="operateur" maxLength={100} defaultValue={v("operateur", operateur)} className={champ} />
        </label>
      </div>
      {age === null && (
        <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Date de naissance absente du dossier : les calculs qui dépendent de l&apos;âge (par exemple la fréquence maximale
          théorique) ne sont pas faits.
        </p>
      )}

      {modele.sections.map((section) => (
        <fieldset key={section.titre} className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">{section.titre}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{section.champs.map(zone)}</div>
        </fieldset>
      ))}

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Calculs et AU TOTAL</legend>
        <p className="mb-3 text-sm text-slate-600" aria-live="polite">
          {calculs.length > 0 ? calculs.join(" · ") : "Les calculs apparaissent quand les mesures nécessaires sont remplies."}
        </p>
        {propositions.length > 0 && (
          <div className="mb-3 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">
              Propositions d&apos;après les mesures (à vérifier ; cliquez pour ajouter)
            </p>
            <ul className="mt-2 space-y-1">
              {propositions.map((p) => (
                <li key={p.texte} className="text-sm">
                  <div className="flex flex-wrap items-start gap-2">
                    <button
                      type="button"
                      onClick={() => ajouter(p)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="h-3 w-3" aria-hidden />
                      Ajouter
                    </button>
                    <span className="text-slate-800">{p.texte}</span>
                    <span className="text-xs text-slate-400">{p.source}</span>
                  </div>
                  {p.seuils.map((id) => (
                    <LigneReference key={id} langue={langue} id={id} reference={references[id]} />
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
        <textarea name="total" rows={6} maxLength={5000} value={total} onChange={(e) => setTotal(e.target.value)} className={champ} />
        <input type="hidden" name="references" value={utilisees.join(",")} />
        {citees.length > 0 && (
          <div className="mt-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Références citées (reprises dans le compte rendu)</p>
            <ul className="mt-1 space-y-1">
              {citees.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Les propositions sont une aide à la rédaction : vous relisez, corrigez et validez. Les références viennent de la
          bibliothèque du cabinet ; une référence « non validée » n&apos;a pas encore été relue par un médecin.
        </p>
      </fieldset>

      <ChoixConsultation consultations={consultations} defaut={consultationDefaut} className="block" />
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}
      <Envoyer />
    </form>
  );
}

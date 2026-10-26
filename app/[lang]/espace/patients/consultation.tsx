"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Save, Trash2 } from "lucide-react";
import { imc, surfaceCorporelle } from "../../../dossier/calculs";
import type { Consultation } from "../../../dossier/consultations";
import type { Correction } from "../../../dossier/correction-locale";
import { enregistrerConsultationPatient, retirerConsultation } from "./actions";
import { DicteeConsultation } from "./dictee";
import { ChampsSuivi, type Choix } from "./suivis";

const libellesConstantes: Record<string, string> = {
  taSys: "TA systolique",
  taDia: "TA diastolique",
  fc: "FC",
  spo2: "SpO₂",
  poids: "Poids",
  taille: "Taille",
};

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-sm font-medium text-slate-700";
const fr = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const lire = (texte: string) => {
  const n = Number(texte.replace(",", "."));
  return texte.trim() && Number.isFinite(n) ? n : null;
};

function Envoyer({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}

// Reprend les rubriques du rapport de consultation du cabinet, dans le même ordre
export function FormulaireConsultation({
  langue,
  patientId,
  consultation,
  tailleConnue,
  definitions,
  choixSuivi,
  dictee,
  aujourdhui,
}: {
  langue: string;
  patientId: number;
  consultation: Consultation | null;
  tailleConnue: number | null;
  definitions: readonly { cle: string; libelle: string; unite: string }[];
  choixSuivi: Choix;
  // Lexique du cabinet pour la correction gratuite ; claude : amélioration par Claude disponible
  dictee: { lexique: { entendu: string; correct: string }[]; claude: boolean };
  aujourdhui: string;
}) {
  const formulaire = useRef<HTMLFormElement>(null);
  const [etat, envoyer] = useActionState(
    enregistrerConsultationPatient.bind(null, langue, patientId, consultation?.id ?? null),
    null,
  );
  const v = (nom: string, initial: string | null | undefined) => (etat ? etat.valeurs[nom] : initial) ?? "";
  const [poids, setPoids] = useState(v("poids", fr(consultation?.poids)));
  const [taille, setTaille] = useState(v("taille", fr(consultation?.taille ?? tailleConnue)));
  const sc = surfaceCorporelle(lire(poids), lire(taille));
  const masse = imc(lire(poids), lire(taille));

  const nombre = (nom: string, libelle: string, initial: number | null | undefined, unite = "", extra = {}) => (
    <label key={nom} className={etiquette}>
      {libelle} {unite && <span className="font-normal text-slate-400">({unite})</span>}
      <input name={nom} inputMode="decimal" defaultValue={v(nom, fr(initial))} className={champ} {...extra} />
    </label>
  );

  // Texte dicté et relu : ajouté à la suite de ce qui est déjà saisi ; valeurs chiffrées dictées : remplacent
  function inserer(c: Correction) {
    const elements = formulaire.current?.elements;
    if (!elements) return;
    for (const [rubrique, texte] of Object.entries(c.rubriques)) {
      const champ = elements.namedItem(rubrique);
      if (!texte || !(champ instanceof HTMLInputElement || champ instanceof HTMLTextAreaElement)) continue;
      const separateur = champ instanceof HTMLInputElement ? " ; " : "\n";
      champ.value = champ.value.trim() ? `${champ.value.trim()}${separateur}${texte}` : texte;
    }
    for (const [cle, valeur] of Object.entries(c.valeurs)) {
      const texte = fr(valeur);
      if (cle === "poids") setPoids(texte);
      else if (cle === "taille") setTaille(texte);
      else {
        const champ = elements.namedItem(cle);
        if (champ instanceof HTMLInputElement) champ.value = texte;
      }
    }
  }

  return (
    <>
      <div className="mb-6">
        <DicteeConsultation
          langue={langue}
          libellesValeurs={{
            ...libellesConstantes,
            ...Object.fromEntries(definitions.map((d) => [d.cle, d.libelle])),
          }}
          lexique={dictee.lexique}
          claude={dictee.claude}
          inserer={inserer}
        />
      </div>
      <form ref={formulaire} action={envoyer} className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <label className={etiquette}>
            Date
            <input
              name="date"
              type="date"
              required
              max={aujourdhui}
              defaultValue={v("date", consultation?.date ?? aujourdhui)}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Motif de consultation
            <input name="motif" maxLength={1000} defaultValue={v("motif", consultation?.motif)} className={champ} />
          </label>
        </div>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">Examen physique</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {nombre("taSys", "TA systolique", consultation?.taSys, "mmHg")}
            {nombre("taDia", "TA diastolique", consultation?.taDia, "mmHg")}
            {nombre("fc", "FC", consultation?.fc, "bpm")}
            {nombre("spo2", "SpO₂", consultation?.spo2, "%")}
            <label className={etiquette}>
              Taille <span className="font-normal text-slate-400">(cm)</span>
              <input
                name="taille"
                inputMode="decimal"
                value={taille}
                onChange={(e) => setTaille(e.target.value)}
                className={champ}
              />
            </label>
            <label className={etiquette}>
              Poids <span className="font-normal text-slate-400">(kg)</span>
              <input
                name="poids"
                inputMode="decimal"
                value={poids}
                onChange={(e) => setPoids(e.target.value)}
                className={champ}
              />
            </label>
          </div>
          <p className="mt-2 text-sm text-slate-500" aria-live="polite">
            {sc ? `SC ${sc.toFixed(2).replace(".", ",")} m²` : "SC : indiquez la taille et le poids"}
            {masse && ` · IMC ${masse.toFixed(1).replace(".", ",")} kg/m²`}
          </p>
          <label className={`${etiquette} mt-3 block`}>
            Examen clinique
            <textarea
              name="examen"
              rows={2}
              maxLength={5000}
              placeholder="RAS"
              defaultValue={v("examen", consultation?.examen)}
              className={champ}
            />
          </label>
        </fieldset>

        <label className={`${etiquette} block`}>
          Électrocardiogramme
          <textarea
            name="ecg"
            rows={2}
            maxLength={2000}
            placeholder="Rythme sinusal, 70 bpm…"
            defaultValue={v("ecg", consultation?.ecg)}
            className={champ}
          />
        </label>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            Valeurs <span className="font-normal text-slate-500">(biologie, échographie : alimentent les courbes)</span>
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {definitions.map((m) =>
              nombre(m.cle, m.libelle, consultation?.mesures[m.cle as keyof Consultation["mesures"]], m.unite),
            )}
          </div>
          <label className={`${etiquette} mt-3 block`}>
            Autres
            <textarea
              name="autres"
              rows={2}
              maxLength={2000}
              placeholder="Autres résultats, ETT du jour…"
              defaultValue={v("autres", consultation?.autres)}
              className={champ}
            />
          </label>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={etiquette}>
            Conclusion
            <textarea
              name="conclusion"
              rows={4}
              maxLength={5000}
              defaultValue={v("conclusion", consultation?.conclusion)}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Conduite à tenir
            <textarea
              name="conduite"
              rows={4}
              maxLength={5000}
              placeholder="Continuer même dose… RV dans 3 mois"
              defaultValue={v("conduite", consultation?.conduite)}
              className={champ}
            />
          </label>
        </div>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            Prochain suivi <span className="font-normal text-slate-500">(facultatif : apparaîtra dans « Suivis »)</span>
          </legend>
          <ChampsSuivi choix={choixSuivi} valeurs={etat?.valeurs} />
        </fieldset>

        {etat && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {etat.erreur}
          </p>
        )}
        <Envoyer className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
          <Save className="h-4 w-4" aria-hidden />
          Enregistrer la consultation
        </Envoyer>
      </form>
    </>
  );
}

export function BoutonSupprimerConsultation({
  langue,
  patientId,
  id,
}: {
  langue: string;
  patientId: number;
  id: number;
}) {
  return (
    <form action={retirerConsultation.bind(null, langue, patientId, id)}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm("Supprimer définitivement cette consultation ?")) e.preventDefault();
        }}
        className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Supprimer la consultation
      </button>
    </form>
  );
}

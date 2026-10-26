"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileCheck, Plus, Trash2, X } from "lucide-react";
import {
  champs2D,
  champsDoppler,
  calculsETT,
  propositionsETT,
  type Champ,
  type DonneesETT,
} from "../../../dossier/ett";
import { medicaments } from "../../../dossier/vocabulaire";
import { nouveauCompteRenduETT, nouvelleOrdonnance, retirerOrdonnance } from "./actions-documents";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-sm font-medium text-slate-700";
const fr = (n: number, chiffres = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: chiffres });

function Envoyer({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      <FileCheck className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

function Erreur({ etat }: { etat: { erreur: string } | null }) {
  if (!etat) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
      {etat.erreur}
    </p>
  );
}

// --- Ordonnance ---

type Ligne = { cle: number; medicament: string; posologie: string; duree: string };

export function FormulaireOrdonnance({
  langue,
  patientId,
  traitements,
}: {
  langue: string;
  patientId: number;
  traitements: { medicament: string; posologie: string }[];
}) {
  const [etat, envoyer] = useActionState(nouvelleOrdonnance.bind(null, langue, patientId), null);
  const compteur = useRef(traitements.length + 1);
  // Les traitements en cours sont proposés d'emblée : une ligne se retire d'un clic
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    traitements.length
      ? traitements.map((t, i) => ({ cle: i, medicament: t.medicament, posologie: t.posologie, duree: "" }))
      : [{ cle: 0, medicament: "", posologie: "", duree: "" }],
  );
  const modifier = (cle: number, nom: keyof Omit<Ligne, "cle">, valeur: string) =>
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, [nom]: valeur } : x)));

  return (
    <form action={envoyer} className="space-y-4">
      <datalist id="medicaments">
        {medicaments.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <ol className="space-y-3">
        {lignes.map((l, i) => (
          <li
            key={l.cle}
            className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[2rem_2fr_2fr_1fr_auto] sm:items-end"
          >
            <span className="text-sm font-semibold text-slate-500 sm:pb-2">{i + 1}.</span>
            <label className={etiquette}>
              Médicament
              <input
                name="medicament"
                list="medicaments"
                maxLength={150}
                value={l.medicament}
                onChange={(e) => modifier(l.cle, "medicament", e.target.value)}
                placeholder="Bisoprolol 2,5 mg"
                className={champ}
              />
            </label>
            <label className={etiquette}>
              Posologie
              <input
                name="posologie"
                maxLength={300}
                value={l.posologie}
                onChange={(e) => modifier(l.cle, "posologie", e.target.value)}
                placeholder="1 cp le matin"
                className={champ}
              />
            </label>
            <label className={etiquette}>
              Durée
              <input
                name="duree"
                maxLength={50}
                value={l.duree}
                onChange={(e) => modifier(l.cle, "duree", e.target.value)}
                placeholder="3 mois"
                className={champ}
              />
            </label>
            <button
              type="button"
              onClick={() => setLignes((x) => x.filter((y) => y.cle !== l.cle))}
              aria-label={`Retirer la ligne ${i + 1}`}
              className="inline-flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setLignes((x) => [...x, { cle: compteur.current++, medicament: "", posologie: "", duree: "" }])}
        className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Ajouter une ligne
      </button>
      <label className={`${etiquette} block`}>
        Remarque <span className="font-normal text-slate-400">(facultatif : régime, contrôle biologique…)</span>
        <textarea name="remarque" rows={3} maxLength={2000} defaultValue={etat?.valeurs.remarque} className={champ} />
      </label>
      <Erreur etat={etat} />
      <Envoyer>Enregistrer l&apos;ordonnance</Envoyer>
    </form>
  );
}

export function BoutonSupprimerOrdonnance({
  langue,
  patientId,
  id,
}: {
  langue: string;
  patientId: number;
  id: number;
}) {
  return (
    <form action={retirerOrdonnance.bind(null, langue, patientId, id)}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm("Supprimer cette ordonnance ? Sa copie part dans la corbeille de Google Drive."))
            e.preventDefault();
        }}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-3 w-3" aria-hidden />
        Supprimer
      </button>
    </form>
  );
}

// --- Compte rendu d'ETT ---

function lireValeurs(formulaire: HTMLFormElement) {
  const donnees = new FormData(formulaire);
  const valeurs: DonneesETT["valeurs"] = {};
  const nombre = (cle: string) => {
    const n = Number(String(donnees.get(cle) ?? "").replace(",", "."));
    return String(donnees.get(cle) ?? "").trim() && Number.isFinite(n) ? n : null;
  };
  for (const c of [...champs2D, ...champsDoppler]) {
    if (c.texte) continue;
    const n = nombre(c.cle);
    if (n !== null) valeurs[c.cle] = n;
  }
  return { valeurs, poids: nombre("poids"), taille: nombre("taille") };
}

export function FormulaireETT({
  langue,
  patientId,
  sexe,
  poids,
  taille,
  operateur,
  aujourdhui,
}: {
  langue: string;
  patientId: number;
  sexe: "" | "F" | "M";
  poids: number | null;
  taille: number | null;
  operateur: string;
  aujourdhui: string;
}) {
  const [etat, envoyer] = useActionState(nouveauCompteRenduETT.bind(null, langue, patientId), null);
  const v = (nom: string, initial = "") => (etat ? etat.valeurs[nom] : initial) ?? "";
  const formulaire = useRef<HTMLFormElement>(null);
  const [saisie, setSaisie] = useState(() => ({ valeurs: {}, poids, taille }));
  const [total, setTotal] = useState(v("total"));
  const calculs = calculsETT(saisie);
  const propositions = propositionsETT(saisie, sexe);
  const ajouter = (texte: string) => setTotal((t) => (t.trim() ? `${t.trim()}\n${texte}` : texte));

  const zone = (c: Champ) => (
    <label key={c.cle} className={etiquette}>
      {c.libelle} {c.unite && <span className="font-normal text-slate-400">({c.unite})</span>}
      <input
        name={c.cle}
        inputMode={c.texte ? undefined : "decimal"}
        maxLength={c.texte ? 300 : 10}
        placeholder={c.exemple}
        defaultValue={v(c.cle)}
        className={champ}
      />
    </label>
  );

  return (
    <form
      ref={formulaire}
      action={envoyer}
      onChange={() => formulaire.current && setSaisie(lireValeurs(formulaire.current))}
      className="space-y-6"
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={etiquette}>
          Date
          <input
            name="date"
            type="date"
            required
            max={aujourdhui}
            defaultValue={v("date", aujourdhui)}
            className={champ}
          />
        </label>
        <label className={`${etiquette} sm:col-span-2`}>
          Indication
          <input
            name="indication"
            maxLength={300}
            placeholder="ACFA, bilan de souffle…"
            defaultValue={v("indication")}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          Opérateur
          <input name="operateur" maxLength={100} defaultValue={v("operateur", operateur)} className={champ} />
        </label>
        <label className={etiquette}>
          Poids <span className="font-normal text-slate-400">(kg)</span>
          <input
            name="poids"
            inputMode="decimal"
            defaultValue={v("poids", poids ? String(poids).replace(".", ",") : "")}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          Taille <span className="font-normal text-slate-400">(cm)</span>
          <input
            name="taille"
            inputMode="decimal"
            defaultValue={v("taille", taille ? String(taille) : "")}
            className={champ}
          />
        </label>
        <p className="self-end pb-2 text-sm text-slate-500 sm:col-span-2" aria-live="polite">
          {calculs.sc ? `SC ${fr(calculs.sc, 2)} m²` : "SC : indiquez le poids et la taille"}
        </p>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Mesures 2D</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {champs2D.map(zone)}
          <label className={etiquette}>
            Méthode FEVG
            <input name="methodeFevg" maxLength={30} defaultValue={v("methodeFevg", "SBP")} className={champ} />
          </label>
        </div>
        <p className="mt-3 text-sm text-slate-600" aria-live="polite">
          {[
            calculs.masseVG !== null && `Masse VG ${Math.round(calculs.masseVG)} g`,
            calculs.masseVGi !== null && `indexée ${Math.round(calculs.masseVGi)} g/m²`,
            calculs.epaisseurRelative !== null && `épaisseur pariétale relative ${fr(calculs.epaisseurRelative, 2)}`,
          ]
            .filter(Boolean)
            .join(" · ") || "Masse VG : indiquez DTDVG, SIV et PP"}
        </p>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Doppler</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{champsDoppler.map(zone)}</div>
        <p className="mt-3 text-sm text-slate-600" aria-live="polite">
          {[
            calculs.gradientVdOd !== null && `Gradient VD-OD ${Math.round(calculs.gradientVdOd)} mmHg`,
            calculs.paps !== null && `PAPS ${Math.round(calculs.paps)} mmHg`,
            calculs.gradientMaxAo !== null && `gradient max aortique ${Math.round(calculs.gradientMaxAo)} mmHg`,
            calculs.surfAoIndexee !== null && `surface aortique indexée ${fr(calculs.surfAoIndexee, 2)} cm²/m²`,
          ]
            .filter(Boolean)
            .join(" · ") || "Calculs Doppler : indiquez Vmax IT et pression OD, Vmax et surface aortiques"}
        </p>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">AU TOTAL</legend>
        {propositions.length > 0 && (
          <div className="mb-3 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">
              Propositions d&apos;après les mesures (à vérifier ; cliquez pour ajouter)
            </p>
            <ul className="mt-2 space-y-1">
              {propositions.map((p) => (
                <li key={p.texte} className="flex flex-wrap items-start gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => ajouter(p.texte)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    Ajouter
                  </button>
                  <span className="text-slate-800">{p.texte}</span>
                  <span className="text-xs text-slate-400">{p.source}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <textarea
          name="total"
          rows={6}
          maxLength={5000}
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          className={champ}
        />
      </fieldset>

      <Erreur etat={etat} />
      <Envoyer>Enregistrer le compte rendu</Envoyer>
    </form>
  );
}

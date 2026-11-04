"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Save, Trash2 } from "lucide-react";
import { ChampsCalcul, couleurs } from "../calculateurs/calculateur";
import { trouverCalculateur } from "../../../dossier/calculateurs";
import { valeursNormalisees } from "../../../dossier/calculateurs/normalisation";
import { preremplir, type DonneesDossier } from "../../../dossier/calculateurs/preremplissage";
import type { Valeurs } from "../../../dossier/calculateurs/types";
import { enregistrerScorePatient, retirerScorePatient } from "./actions";

const champ =
  "mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// Choix du calcul par le médecin, saisie, résultat, puis enregistrement daté dans le dossier
export function FormulaireScore({
  langue,
  patientId,
  catalogue,
  aujourdhui,
  donnees,
}: {
  langue: string;
  patientId: number;
  catalogue: { slug: string; titre: string }[];
  aujourdhui: string;
  donnees: DonneesDossier;
}) {
  const [slug, setSlug] = useState("");
  const [date, setDate] = useState(aujourdhui);
  // Seules les valeurs changées à la main sont gardées ; le reste vient du dossier
  const [modifies, setModifies] = useState<Valeurs>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [enCours, transition] = useTransition();

  const calculateur = slug ? trouverCalculateur(slug) : undefined;
  const repris = calculateur ? preremplir(calculateur, donnees) : { valeurs: {}, origines: {} };
  const valeurs: Valeurs = { ...repris.valeurs, ...modifies };
  // Origines affichées seulement pour les valeurs que le médecin n'a pas touchées
  const origines = Object.fromEntries(Object.entries(repris.origines).filter(([cle]) => !(cle in modifies)));
  // Les réponses affichées sont celles qui seront enregistrées (les choix non touchés prennent leur première option)
  const propres = calculateur ? valeursNormalisees(calculateur, valeurs) : {};
  const resultat = calculateur?.evaluer(propres);
  const regler = (cle: string, valeur: boolean | string | number | undefined) => {
    setEnregistre(false);
    setModifies((v) => ({ ...v, [cle]: valeur }));
  };

  function enregistrer() {
    if (!calculateur) return;
    setErreur(null);
    transition(async () => {
      const refus = await enregistrerScorePatient(langue, patientId, calculateur.slug, date, propres);
      if (refus) setErreur(refus);
      else {
        setEnregistre(true);
        setModifies({});
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Calcul
          <select
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setModifies({});
              setEnregistre(false);
              setErreur(null);
            }}
            className={`${champ} min-w-64`}
          >
            <option value="">Choisir un calcul…</option>
            {catalogue.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.titre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm font-medium text-slate-700">
          Date du calcul
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
        </label>
      </div>

      {calculateur && resultat && (
        <>
          <div className="mt-5">
            <ChampsCalcul calculateur={calculateur} valeurs={valeurs} regler={regler} origines={origines} />
          </div>

          <div className={`mt-5 rounded-xl p-4 ${couleurs[resultat.gravite]}`} aria-live="polite">
            <p>
              {resultat.score !== null && (
                <>
                  Score : <strong className="text-lg">{resultat.score}</strong> ·{" "}
                </>
              )}
              <strong>{resultat.libelle}</strong>
            </p>
            {resultat.recommandation && <p className="mt-2 text-sm">{resultat.recommandation}</p>}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={enregistrer}
              disabled={enCours || !date}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {enCours ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              Enregistrer dans le dossier
            </button>
            {enregistre && <span className="text-sm text-emerald-700">Calcul enregistré.</span>}
            {erreur && <span className="text-sm text-red-700">{erreur}</span>}
          </div>
          {calculateur.notes?.map((n) => (
            <p key={n} className="mt-3 text-xs text-slate-500">
              {n}
            </p>
          ))}
        </>
      )}
    </div>
  );
}

export function BoutonRetirerScore({ langue, patientId, id }: { langue: string; patientId: number; id: number }) {
  const [enCours, transition] = useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => {
        if (window.confirm("Supprimer ce calcul du dossier ?")) transition(() => retirerScorePatient(langue, patientId, id));
      }}
      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700 disabled:opacity-60"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      Supprimer
    </button>
  );
}

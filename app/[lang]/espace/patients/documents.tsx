"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink, FileCheck, Lightbulb, Plus, Trash2, X } from "lucide-react";
import {
  champs2D,
  champsDoppler,
  calculsETT,
  propositionsETT,
  type Champ,
  type DonneesETT,
} from "../../../dossier/ett";
import { ajouterProposition, referencesCitees } from "../../../dossier/comptes-rendus/references";
import { avecSeuils } from "../../../dossier/comptes-rendus/references-propositions";
import type { ReferenceSeuil } from "../../../dossier/comptes-rendus/seuils";
import { aidePrescription, nouveauCompteRenduETT, nouvelleOrdonnance, rechercherMedicaments, retirerOrdonnance } from "./actions-documents";
import type { Suggestion } from "../../../dossier/aide-prescription";
import type { MedicamentMa } from "../../../dossier/medicaments-ma";
import { LigneReference } from "./reference-seuil";
import { ChoixConsultation } from "./choix-consultation";
import { libelleConsultation, type OptionConsultation } from "../../../dossier/choix-consultation";

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

type FicheLiee = Partial<MedicamentMa> & { nom: string; url: string };
type Ligne = { cle: number; medicament: string; posologie: string; duree: string; fiche?: FicheLiee };

// Champ « médicament » : suggestions de la base medicament.ma (nom, DCI, classe, prix) avec lien vers la fiche
function ChampMedicament({
  valeur,
  onChange,
  onChoix,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onChoix: (m: MedicamentMa) => void;
}) {
  const [propositions, setPropositions] = useState<MedicamentMa[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dernier = useRef(0);

  const saisir = (v: string) => {
    onChange(v);
    clearTimeout(minuteur.current);
    if (v.trim().length < 2) return setPropositions([]);
    minuteur.current = setTimeout(async () => {
      const n = ++dernier.current;
      const r = await rechercherMedicaments(v).catch(() => []);
      if (n === dernier.current) {
        setPropositions(r);
        setOuvert(true);
      }
    }, 250);
  };

  return (
    <label className={`${etiquette} relative block`}>
      Médicament
      <input
        name="medicament"
        maxLength={150}
        value={valeur}
        autoComplete="off"
        onChange={(e) => saisir(e.target.value)}
        onFocus={() => propositions.length && setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        placeholder="Bisoprolol 2,5 mg"
        className={champ}
      />
      {ouvert && propositions.length > 0 && (
        <ul className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white text-left shadow-lg">
          {propositions.map((m) => (
            <li key={m.url}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChoix(m);
                  setOuvert(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-red-50"
              >
                <span className="block text-sm font-medium text-slate-900">{m.nom}</span>
                <span className="block text-xs font-normal text-slate-500">
                  {[m.dci, m.labo, m.ppv && `PPV ${m.ppv}`].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

// Aide à la prescription : repère les situations de la consultation choisie et propose familles, substances,
// posologies usuelles et produits (nom = lien vers la fiche medicament.ma). Information seulement.
function AidePrescription({
  patientId,
  consultations,
  defaut,
  onAjouter,
}: {
  patientId: number;
  consultations: OptionConsultation[];
  defaut?: number;
  onAjouter: (p: FicheLiee) => void;
}) {
  const [consultation, setConsultation] = useState<string>(String(defaut ?? consultations[0]?.id ?? ""));
  const [reponse, setReponse] = useState<{ pour: string; valeur: Suggestion[] | "erreur" } | null>(null);
  // Tant que la réponse ne correspond pas à la consultation choisie, l'analyse est en cours
  const resultat = reponse?.pour === consultation ? reponse.valeur : null;

  useEffect(() => {
    let actuel = true;
    aidePrescription(patientId, consultation ? Number(consultation) : null)
      .then((r) => actuel && setReponse({ pour: consultation, valeur: r ?? "erreur" }))
      .catch(() => actuel && setReponse({ pour: consultation, valeur: "erreur" }));
    return () => {
      actuel = false;
    };
  }, [patientId, consultation]);

  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-amber-950">
        <Lightbulb className="h-4 w-4" aria-hidden />
        Aide à la prescription (information, selon la consultation)
        {Array.isArray(resultat) && resultat.length > 0 && (
          <span className="rounded-full bg-amber-200 px-2 text-xs">{resultat.length} situation(s)</span>
        )}
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-xs text-amber-900">
          Repères tirés du texte de la consultation, des constantes et des antécédents. Ce ne sont que des pistes et des
          posologies usuelles de l&apos;adulte : vous seul décidez, en fonction du patient (âge, poids, fonction
          rénale, interactions, grossesse). Chaque nom ouvre la fiche officielle sur medicament.ma.
        </p>
        {consultations.length > 0 && (
          <label className="block text-xs font-medium text-slate-700">
            Consultation analysée
            <select value={consultation} onChange={(e) => setConsultation(e.target.value)} className={champ}>
              {consultations.map((c) => (
                <option key={c.id} value={c.id}>
                  {libelleConsultation(c)}
                </option>
              ))}
              <option value="">Aucune (antécédents seuls)</option>
            </select>
          </label>
        )}
        {resultat === null && <p className="text-xs text-slate-500">Analyse en cours…</p>}
        {resultat === "erreur" && <p className="text-xs text-red-700">Aide indisponible pour le moment.</p>}
        {Array.isArray(resultat) && resultat.length === 0 && (
          <p className="text-xs text-slate-600">
            Aucune situation reconnue dans cette consultation (HTA, insuffisance cardiaque, angor, FA, dyslipidémie…).
            Utilisez la recherche de la bibliothèque (Médicaments) pour explorer par famille ou par symptôme.
          </p>
        )}
        {Array.isArray(resultat) &&
          resultat.map((s) => (
            <section key={s.cle} className="rounded-lg border border-amber-200 bg-white p-3">
              <h3 className="font-semibold text-slate-900">{s.libelle}</h3>
              <p className="text-xs text-slate-500">Repéré : {s.raisons.join(" ; ")}</p>
              <div className="mt-2 space-y-2">
                {s.groupes.map((g) => (
                  <details key={g.cle} className="rounded-md bg-slate-50 p-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-800">
                      {g.libelle}{" "}
                      <span className="font-normal text-slate-500">
                        ({g.propositions.map((p) => p.dci).join(", ")})
                      </span>
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {g.propositions.map((p) => (
                        <li key={p.dci} className="text-xs text-slate-700">
                          <p>
                            <span className="font-semibold capitalize text-slate-900">{p.dci}</span>
                            {p.dejaPris && <span className="ms-2 rounded bg-emerald-100 px-1.5 text-emerald-800">déjà au traitement</span>}
                            {p.allergie && (
                              <span className="ms-2 rounded bg-red-100 px-1.5 text-red-800">
                                allergie notée : « {p.allergie} »
                              </span>
                            )}
                          </p>
                          {p.posologie && <p>Repère : {p.posologie}</p>}
                          {p.attention && <p className="text-slate-500">À surveiller : {p.attention}</p>}
                          {p.produits.length > 0 && (
                            <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                              {p.produits.map((m) => (
                                <span key={m.url} className="inline-flex items-center gap-1">
                                  <a
                                    href={m.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-red-700 underline"
                                  >
                                    {m.nom}
                                  </a>
                                  <span className="text-slate-400">{m.ppv}</span>
                                  <button
                                    type="button"
                                    onClick={() => onAjouter({ nom: m.nom, url: m.url, ppv: m.ppv, generique: m.generique })}
                                    className="rounded border border-slate-300 px-1 text-[11px] text-slate-600 hover:bg-slate-100"
                                    title="Ajoute le nom à l'ordonnance, sans posologie : à compléter par vos soins"
                                  >
                                    + ordonnance
                                  </button>
                                </span>
                              ))}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          ))}
      </div>
    </details>
  );
}

// Informations essentielles du médicament choisi + lien vers sa fiche publique
function FicheMedicament({ m }: { m: FicheLiee }) {
  const infos: [string, string][] = [
    ["DCI", m.dci ?? ""],
    ["Dosage", m.dosage ?? ""],
    ["Présentation", m.presentation ?? ""],
    ["Classe", m.classe ?? ""],
    ["Laboratoire", m.labo ?? ""],
    ["PPV", m.ppv ?? ""],
    ["Statut", m.statut ?? ""],
    ["Tableau", m.tableau ?? ""],
  ];
  return (
    <div className="sm:col-span-full rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {infos
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="font-medium text-slate-500">{k} :</dt>
              <dd className="text-slate-800">{v}</dd>
            </div>
          ))}
      </dl>
      <a
        href={m.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 font-medium text-red-700 hover:underline"
      >
        <ExternalLink className="h-3 w-3" aria-hidden />
        Fiche sur medicament.ma
      </a>
    </div>
  );
}

export function FormulaireOrdonnance({
  langue,
  patientId,
  traitements,
  consultations,
  consultationDefaut,
}: {
  langue: string;
  patientId: number;
  traitements: { medicament: string; posologie: string }[];
  consultations: OptionConsultation[];
  consultationDefaut?: number;
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
      <ol className="space-y-3">
        {lignes.map((l, i) => (
          <li
            key={l.cle}
            className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[2rem_2fr_2fr_1fr_auto] sm:items-end"
          >
            <span className="text-sm font-semibold text-slate-500 sm:pb-2">{i + 1}.</span>
            <input type="hidden" name="fiche" value={l.fiche && l.fiche.nom === l.medicament ? l.fiche.url : ""} />
            <ChampMedicament
              valeur={l.medicament}
              onChange={(v) => modifier(l.cle, "medicament", v)}
              onChoix={(m) => setLignes((x) => x.map((y) => (y.cle === l.cle ? { ...y, medicament: m.nom.slice(0, 150), fiche: m } : y)))}
            />
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
            {l.fiche && l.fiche.nom === l.medicament && <FicheMedicament m={l.fiche} />}
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
      <ChoixConsultation consultations={consultations} defaut={consultationDefaut} className="block" />
      <AidePrescription
        patientId={patientId}
        consultations={consultations}
        defaut={consultationDefaut}
        onAjouter={(p) =>
          setLignes((x) => [...x, { cle: compteur.current++, medicament: p.nom.slice(0, 150), posologie: "", duree: "", fiche: p }])
        }
      />
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
  references,
  consultations,
  consultationDefaut,
}: {
  langue: string;
  patientId: number;
  sexe: "" | "F" | "M";
  poids: number | null;
  taille: number | null;
  operateur: string;
  aujourdhui: string;
  references: Record<string, ReferenceSeuil>;
  consultations: OptionConsultation[];
  consultationDefaut?: number;
}) {
  const [etat, envoyer] = useActionState(nouveauCompteRenduETT.bind(null, langue, patientId), null);
  const v = (nom: string, initial = "") => (etat ? etat.valeurs[nom] : initial) ?? "";
  const formulaire = useRef<HTMLFormElement>(null);
  const [saisie, setSaisie] = useState(() => ({ valeurs: {}, poids, taille }));
  const [total, setTotal] = useState(v("total"));
  const [utilisees, setUtilisees] = useState<string[]>([]);
  const calculs = calculsETT(saisie);
  const propositions = avecSeuils("ett", propositionsETT(saisie, sexe));
  // Chaque proposition ajoutée porte le repère de ses références, citées en bas du compte rendu
  const ajouter = (p: { texte: string; seuils: string[] }) => {
    const r = ajouterProposition(total, utilisees, p);
    setTotal(r.total);
    setUtilisees(r.utilisees);
  };
  const citees = referencesCitees(total, utilisees, references);

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
        <textarea
          name="total"
          rows={6}
          maxLength={5000}
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          className={champ}
        />
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
      <Erreur etat={etat} />
      <Envoyer>Enregistrer le compte rendu</Envoyer>
    </form>
  );
}

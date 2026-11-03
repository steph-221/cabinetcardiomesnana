"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Ban, Check, Plus, Receipt, Trash2 } from "lucide-react";
import {
  categoriesCharges,
  lireMontant,
  mad,
  modesPaiement,
  pourChamp,
  totalFacture,
} from "../../../dossier/compta-calculs";
import {
  annuler,
  nouvelleCharge,
  nouvelleFacture,
  nouveauPaiement,
  reglerActe,
  reglerPartage,
  reglerPraticien,
  reglerRecurrente,
  retirerActe,
  retirerCharge,
  retirerPaiement,
  retirerRecurrente,
} from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const libelleChamp = "text-sm font-medium text-slate-700";
const boutonPlein =
  "inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700";
const boutonSombre =
  "inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800";

function Envoyer({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}

function Erreur({ etat }: { etat: { erreur: string } | null }) {
  return etat ? (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
      {etat.erreur}
    </p>
  ) : null;
}

type Praticien = { id: number; nom: string };

// --- Facture ---

type LigneSaisie = { cle: number; libelle: string; quantite: string; prix: string };

export function FormulaireFacture({
  langue,
  patient,
  praticiens,
  praticienParDefaut,
  actes,
  aujourdhui,
}: {
  langue: string;
  patient: { id: number; nom: string } | null;
  praticiens: Praticien[];
  praticienParDefaut: number;
  actes: { id: number; libelle: string; tarifCts: number }[];
  aujourdhui: string;
}) {
  const [etat, envoyer] = useActionState(nouvelleFacture.bind(null, langue), null);
  const compteur = useRef(1);
  const nouvelleLigne = (libelle = "", prixCts: number | null = null): LigneSaisie => ({
    cle: compteur.current++,
    libelle,
    quantite: "1",
    prix: prixCts === null ? "" : pourChamp(prixCts),
  });
  const [lignes, setLignes] = useState<LigneSaisie[]>(() => [
    {
      cle: 0,
      libelle: actes[0]?.libelle ?? "",
      quantite: "1",
      prix: actes[0] ? pourChamp(actes[0].tarifCts) : "",
    },
  ]);
  const [remise, setRemise] = useState("");
  const [mode, setMode] = useState("especes");
  const [encaisse, setEncaisse] = useState<string | null>(null); // null = le total, suivi automatiquement

  const modifier = (cle: number, changement: Partial<LigneSaisie>) =>
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, ...changement } : x)));

  const calcul = lignes.map((l) => ({
    libelle: l.libelle,
    quantite: Number(l.quantite.replace(",", ".")) || 0,
    prixCts: lireMontant(l.prix) ?? 0,
  }));
  const remiseCts = lireMontant(remise) ?? 0;
  const total = totalFacture(calcul, remiseCts);

  return (
    <form action={envoyer} className="space-y-6">
      {patient ? (
        <input type="hidden" name="patient" value={patient.id} />
      ) : (
        <label className={`${libelleChamp} block`}>
          Nom du patient (sans dossier)
          <input
            name="patient_nom"
            required
            maxLength={120}
            defaultValue={etat?.valeurs.patient_nom}
            className={champ}
            autoComplete="off"
          />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={libelleChamp}>
          Date de la facture
          <input
            type="date"
            name="date"
            required
            max={aujourdhui}
            defaultValue={etat?.valeurs.date ?? aujourdhui}
            className={champ}
          />
        </label>
        <label className={libelleChamp}>
          Médecin
          <select name="praticien" defaultValue={etat?.valeurs.praticien ?? praticienParDefaut} className={champ}>
            {praticiens.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-900">Actes</legend>
        <div className="mb-3 flex flex-wrap gap-2">
          {actes.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setLignes((l) => [...l, nouvelleLigne(a.libelle, a.tarifCts)])}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" aria-hidden />
              {a.libelle} · {mad(a.tarifCts, true)}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {lignes.map((l, i) => (
            <li key={l.cle} className="grid grid-cols-[1fr_4rem_6.5rem_auto] items-end gap-2">
              <label className="text-xs text-slate-500">
                {i === 0 && "Désignation"}
                <input
                  name="libelle"
                  value={l.libelle}
                  onChange={(e) => modifier(l.cle, { libelle: e.target.value })}
                  maxLength={150}
                  aria-label={`Désignation de la ligne ${i + 1}`}
                  className={champ}
                />
              </label>
              <label className="text-xs text-slate-500">
                {i === 0 && "Qté"}
                <input
                  name="quantite"
                  value={l.quantite}
                  onChange={(e) => modifier(l.cle, { quantite: e.target.value })}
                  inputMode="decimal"
                  aria-label={`Quantité de la ligne ${i + 1}`}
                  className={champ}
                />
              </label>
              <label className="text-xs text-slate-500">
                {i === 0 && "Prix (MAD)"}
                <input
                  name="prix"
                  value={l.prix}
                  onChange={(e) => modifier(l.cle, { prix: e.target.value })}
                  inputMode="decimal"
                  aria-label={`Prix unitaire de la ligne ${i + 1}`}
                  className={champ}
                />
              </label>
              <button
                type="button"
                onClick={() => setLignes((x) => (x.length > 1 ? x.filter((y) => y.cle !== l.cle) : x))}
                disabled={lignes.length === 1}
                aria-label={`Retirer la ligne ${i + 1}`}
                className="mb-1 rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setLignes((l) => [...l, nouvelleLigne()])}
          className="mt-3 inline-flex items-center gap-1 text-sm text-red-700 hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ligne libre
        </button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className={libelleChamp}>
          Remarque (facultatif)
          <input name="note" maxLength={500} defaultValue={etat?.valeurs.note} className={champ} />
        </label>
        <label className={libelleChamp}>
          Remise (MAD)
          <input
            name="remise"
            value={remise}
            onChange={(e) => setRemise(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className={`${champ} sm:w-32`}
          />
        </label>
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="flex items-baseline justify-between text-lg font-semibold text-slate-900">
          <span>Total à payer</span>
          <span>{mad(total)}</span>
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className={libelleChamp}>
            Encaissement
            <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={champ}>
              {modesPaiement.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {m.libelle}
                </option>
              ))}
              <option value="aucun">Pas encore payé</option>
            </select>
          </label>
          {mode !== "aucun" && (
            <>
              <label className={libelleChamp}>
                Montant encaissé (MAD)
                <input
                  name="encaisse"
                  value={encaisse ?? pourChamp(total)}
                  onChange={(e) => setEncaisse(e.target.value)}
                  inputMode="decimal"
                  className={champ}
                />
              </label>
              <label className={libelleChamp}>
                Référence (n° de chèque…)
                <input name="reference" maxLength={80} defaultValue={etat?.valeurs.reference} className={champ} />
              </label>
            </>
          )}
        </div>
        {mode !== "aucun" && encaisse !== null && (lireMontant(encaisse) ?? 0) < total && (
          <p className="mt-2 text-xs text-slate-500">
            Acompte : il restera {mad(total - (lireMontant(encaisse) ?? 0))} à encaisser.
          </p>
        )}
      </div>

      <Erreur etat={etat} />
      <Envoyer className={boutonPlein}>
        <Receipt className="h-4 w-4" aria-hidden />
        Enregistrer la facture
      </Envoyer>
    </form>
  );
}

// --- Paiement d'une facture ---

export function FormulairePaiement({
  langue,
  factureId,
  reste,
  aujourdhui,
  debut,
}: {
  langue: string;
  factureId: number;
  reste: number;
  aujourdhui: string;
  debut: string;
}) {
  const [etat, envoyer] = useActionState(nouveauPaiement.bind(null, langue, factureId), null);
  return (
    <form action={envoyer} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <label className={libelleChamp}>
        Date
        <input type="date" name="date" required min={debut} max={aujourdhui} defaultValue={aujourdhui} className={champ} />
      </label>
      <label className={libelleChamp}>
        Montant (MAD)
        <input name="montant" required inputMode="decimal" key={reste} defaultValue={pourChamp(reste)} className={champ} />
      </label>
      <label className={libelleChamp}>
        Mode
        <select name="mode" defaultValue="especes" className={champ}>
          {modesPaiement.map((m) => (
            <option key={m.valeur} value={m.valeur}>
              {m.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className={libelleChamp}>
        Référence
        <input name="reference" maxLength={80} placeholder="n° de chèque…" className={champ} />
      </label>
      <div className="sm:col-span-4">
        <Envoyer className={boutonSombre}>
          <Check className="h-4 w-4" aria-hidden />
          Enregistrer le paiement
        </Envoyer>
      </div>
      {etat && (
        <div className="sm:col-span-4">
          <Erreur etat={etat} />
        </div>
      )}
    </form>
  );
}

export function BoutonRetirerPaiement({ langue, factureId, id }: { langue: string; factureId: number; id: number }) {
  return (
    <form action={retirerPaiement.bind(null, langue, factureId, id)}>
      <Envoyer className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50">
        <Trash2 className="h-3 w-3" aria-hidden />
        Supprimer
      </Envoyer>
    </form>
  );
}

export function FormulaireAnnulation({ langue, factureId }: { langue: string; factureId: number }) {
  const [etat, envoyer] = useActionState(annuler.bind(null, langue, factureId), null);
  return (
    <details className="text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-red-700 hover:underline">
        <Ban className="h-4 w-4" aria-hidden />
        Annuler cette facture
      </summary>
      <form action={envoyer} className="mt-3 space-y-3">
        <p className="text-slate-500">
          Une facture n&apos;est jamais supprimée (la numérotation reste continue) : elle est marquée annulée et ne
          compte plus dans les comptes.
        </p>
        <label className={`${libelleChamp} block`}>
          Motif
          <input name="motif" required maxLength={200} className={champ} />
        </label>
        <Erreur etat={etat} />
        <Envoyer className={boutonSombre}>Annuler la facture</Envoyer>
      </form>
    </details>
  );
}

// --- Charges ---

export function FormulaireCharge({
  langue,
  praticiens,
  aujourdhui,
}: {
  langue: string;
  praticiens: Praticien[];
  aujourdhui: string;
}) {
  const [etat, envoyer] = useActionState(nouvelleCharge.bind(null, langue), null);
  return (
    <form action={envoyer} className="grid gap-4 sm:grid-cols-6">
      <label className={`${libelleChamp} sm:col-span-2`}>
        Date
        <input type="date" name="date" required max={aujourdhui} defaultValue={etat?.valeurs.date ?? aujourdhui} className={champ} />
      </label>
      <label className={`${libelleChamp} sm:col-span-2`}>
        Catégorie
        <select name="categorie" required defaultValue={etat?.valeurs.categorie ?? ""} className={champ}>
          <option value="" disabled>
            Choisir…
          </option>
          {categoriesCharges.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className={`${libelleChamp} sm:col-span-2`}>
        Montant (MAD)
        <input name="montant" required inputMode="decimal" defaultValue={etat?.valeurs.montant} className={champ} />
      </label>
      <label className={`${libelleChamp} sm:col-span-3`}>
        Libellé
        <input name="libelle" required maxLength={150} placeholder="Loyer de novembre" defaultValue={etat?.valeurs.libelle} className={champ} />
      </label>
      <label className={`${libelleChamp} sm:col-span-3`}>
        Fournisseur (facultatif)
        <input name="fournisseur" maxLength={120} defaultValue={etat?.valeurs.fournisseur} className={champ} />
      </label>
      <label className={`${libelleChamp} sm:col-span-3`}>
        Payée par
        <select name="mode" defaultValue={etat?.valeurs.mode ?? "virement"} className={champ}>
          {modesPaiement
            .filter((m) => m.valeur !== "mutuelle")
            .map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.libelle}
              </option>
            ))}
        </select>
      </label>
      <label className={`${libelleChamp} sm:col-span-3`}>
        À la charge de
        <select name="imputation" defaultValue={etat?.valeurs.imputation ?? "commune"} className={champ}>
          <option value="commune">Le cabinet (partagée entre les médecins)</option>
          {praticiens.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom} seulement
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-6">
        <Erreur etat={etat} />
        <div className={etat ? "mt-3" : ""}>
          <Envoyer className={boutonPlein}>
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter la charge
          </Envoyer>
        </div>
      </div>
    </form>
  );
}

export function BoutonRetirerCharge({ langue, id }: { langue: string; id: number }) {
  return (
    <form action={retirerCharge.bind(null, langue, id)}>
      <Envoyer className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50">
        <Trash2 className="h-3 w-3" aria-hidden />
        Supprimer
      </Envoyer>
    </form>
  );
}

// --- Réglages ---

export function FormulairePraticien({
  langue,
  praticien,
}: {
  langue: string;
  praticien: { id: number; nom: string; compte: string | null; part: number; actif: boolean } | null;
}) {
  const [etat, envoyer] = useActionState(reglerPraticien.bind(null, langue, praticien?.id ?? null), null);
  return (
    <form action={envoyer} className="grid gap-3 sm:grid-cols-[1fr_9rem_6rem_auto_auto] sm:items-end">
      <label className={libelleChamp}>
        {praticien ? "Nom" : "Nouveau médecin"}
        <input name="nom" required maxLength={100} defaultValue={praticien?.nom} placeholder="Dr Prénom Nom" className={champ} />
      </label>
      <label className={libelleChamp}>
        Identifiant de connexion
        <input name="compte" maxLength={30} defaultValue={praticien?.compte ?? ""} placeholder="facultatif" className={champ} />
      </label>
      <label className={libelleChamp}>
        Part (%)
        <input name="part" required inputMode="numeric" defaultValue={praticien?.part ?? 50} className={champ} />
      </label>
      {praticien ? (
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" name="actif" defaultChecked={praticien.actif} className="h-4 w-4" />
          Actif
        </label>
      ) : (
        <span />
      )}
      <Envoyer className={boutonSombre}>{praticien ? "Enregistrer" : "Ajouter"}</Envoyer>
      {etat && (
        <div className="sm:col-span-5">
          <Erreur etat={etat} />
        </div>
      )}
    </form>
  );
}

export function InterrupteurPartage({ langue, actif }: { langue: string; actif: boolean }) {
  return (
    <form action={reglerPartage.bind(null, langue, !actif)}>
      <Envoyer className={actif ? boutonSombre : "inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"}>
        {actif ? "Résultat mis en commun — repasser aux honoraires individuels" : "Mettre le résultat en commun"}
      </Envoyer>
    </form>
  );
}

export function FormulaireActe({
  langue,
  acte,
}: {
  langue: string;
  acte: { id: number; libelle: string; tarifCts: number } | null;
}) {
  const [etat, envoyer] = useActionState(reglerActe.bind(null, langue, acte?.id ?? null), null);
  return (
    <form action={envoyer} className="grid gap-3 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-end">
      <label className={libelleChamp}>
        {acte ? <span className="sr-only">Acte</span> : "Nouvel acte"}
        <input name="libelle" required maxLength={150} defaultValue={acte?.libelle} aria-label="Acte" className={champ} />
      </label>
      <label className={libelleChamp}>
        {acte ? <span className="sr-only">Tarif en MAD</span> : "Tarif (MAD)"}
        <input
          name="tarif"
          required
          inputMode="decimal"
          defaultValue={acte ? pourChamp(acte.tarifCts) : ""}
          aria-label="Tarif en MAD"
          className={champ}
        />
      </label>
      <Envoyer className={boutonSombre}>{acte ? "Enregistrer" : "Ajouter"}</Envoyer>
      {acte ? <BoutonRetirerActe langue={langue} id={acte.id} /> : <span />}
      {etat && (
        <div className="sm:col-span-4">
          <Erreur etat={etat} />
        </div>
      )}
    </form>
  );
}

function BoutonRetirerActe({ langue, id }: { langue: string; id: number }) {
  // Bouton hors du formulaire parent : formAction dédié
  return (
    <button
      type="submit"
      formAction={retirerActe.bind(null, langue, id)}
      formNoValidate
      className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-xs text-red-700 hover:bg-red-50"
    >
      <Trash2 className="h-3 w-3" aria-hidden />
      Retirer
    </button>
  );
}

// --- Charges récurrentes ---

export function FormulaireRecurrente({
  langue,
  praticiens,
  aujourdhui,
  modele,
}: {
  langue: string;
  praticiens: Praticien[];
  aujourdhui: string;
  modele: {
    id: number;
    categorie: string;
    libelle: string;
    fournisseur: string;
    montantCts: number;
    mode: string;
    praticienId: number | null;
    jour: number;
    debut: string;
    fin: string | null;
    actif: boolean;
  } | null;
}) {
  const [etat, envoyer] = useActionState(reglerRecurrente.bind(null, langue, modele?.id ?? null), null);
  const v = etat?.valeurs;
  return (
    <form action={envoyer} className="grid gap-3 sm:grid-cols-6">
      <label className={`${libelleChamp} sm:col-span-3`}>
        Libellé
        <input name="libelle" required maxLength={150} placeholder="Loyer du cabinet" defaultValue={v?.libelle ?? modele?.libelle} className={champ} />
      </label>
      <label className={`${libelleChamp} sm:col-span-2`}>
        Catégorie
        <select name="categorie" required defaultValue={v?.categorie ?? modele?.categorie ?? ""} className={champ}>
          <option value="" disabled>
            Choisir…
          </option>
          {categoriesCharges.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className={libelleChamp}>
        Montant (MAD)
        <input name="montant" required inputMode="decimal" defaultValue={v?.montant ?? (modele ? pourChamp(modele.montantCts) : "")} className={champ} />
      </label>
      <label className={libelleChamp}>
        Jour du mois
        <input name="jour" required inputMode="numeric" maxLength={2} defaultValue={v?.jour ?? modele?.jour ?? 1} className={champ} />
      </label>
      <label className={libelleChamp}>
        À partir du
        <input type="date" name="debut" required defaultValue={v?.debut ?? modele?.debut ?? aujourdhui} className={champ} />
      </label>
      <label className={libelleChamp}>
        Jusqu&apos;au (facultatif)
        <input type="date" name="fin" defaultValue={v?.fin ?? modele?.fin ?? ""} className={champ} />
      </label>
      <label className={libelleChamp}>
        Payée par
        <select name="mode" defaultValue={v?.mode ?? modele?.mode ?? "virement"} className={champ}>
          {modesPaiement
            .filter((m) => m.valeur !== "mutuelle")
            .map((m) => (
              <option key={m.valeur} value={m.valeur}>
                {m.libelle}
              </option>
            ))}
        </select>
      </label>
      <label className={`${libelleChamp} sm:col-span-2`}>
        À la charge de
        <select name="imputation" defaultValue={v?.imputation ?? modele?.praticienId ?? "commune"} className={champ}>
          <option value="commune">Le cabinet (commune)</option>
          {praticiens.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom} seulement
            </option>
          ))}
        </select>
      </label>
      <label className={`${libelleChamp} sm:col-span-2`}>
        Fournisseur (facultatif)
        <input name="fournisseur" maxLength={120} defaultValue={v?.fournisseur ?? modele?.fournisseur} className={champ} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <Envoyer className={modele ? boutonSombre : boutonPlein}>
          {modele ? (
            "Enregistrer"
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden />
              Ajouter la récurrence
            </>
          )}
        </Envoyer>
        {modele && (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="actif" defaultChecked={modele.actif} className="h-4 w-4" />
              Active
            </label>
            <button
              type="submit"
              formAction={retirerRecurrente.bind(null, langue, modele.id)}
              formNoValidate
              className="ms-auto inline-flex items-center gap-1 rounded-md px-2 py-2 text-xs text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Supprimer la récurrence
            </button>
          </>
        )}
      </div>
      {etat && (
        <div className="sm:col-span-6">
          <Erreur etat={etat} />
        </div>
      )}
    </form>
  );
}

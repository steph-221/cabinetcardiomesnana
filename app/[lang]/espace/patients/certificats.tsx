"use client";

import { useActionState, useState } from "react";
import { BookmarkPlus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  composerCertificat,
  GROUPE_PERSO,
  groupesModeles,
  modeleDepuisPerso,
  modeles as modelesDuCabinet,
  valeursInitiales,
  type ContexteCertificat,
  type ModelePerso,
  type Valeurs,
} from "../../../dossier/certificats-modeles";
import type { OptionConsultation } from "../../../dossier/choix-consultation";
import {
  ajouterModeleCertificat,
  changerModeleCertificat,
  nouveauCertificat,
  retirerCertificat,
  retirerModeleCertificat,
} from "./actions-documents";
import { ChoixConsultation } from "./choix-consultation";
import { BoutonsEnregistrer } from "./boutons-document";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-sm font-medium text-slate-700";

export function FormulaireCertificat({
  langue,
  patientId,
  contexte,
  consultations,
  consultationDefaut,
  modelesPerso = [],
}: {
  langue: string;
  patientId: number;
  contexte: ContexteCertificat;
  consultations: OptionConsultation[];
  consultationDefaut?: number;
  // Modèles créés par les médecins du cabinet
  modelesPerso?: ModelePerso[];
}) {
  const [etat, envoyer] = useActionState(nouveauCertificat.bind(null, langue, patientId), null);
  const [perso, setPerso] = useState<ModelePerso[]>(modelesPerso);
  const modeles = [...modelesDuCabinet, ...perso.map(modeleDepuisPerso)];
  const groupes = perso.length ? [...groupesModeles, GROUPE_PERSO] : groupesModeles;
  const [cle, setCle] = useState(modelesDuCabinet[0].cle);
  const modele = modeles.find((m) => m.cle === cle) ?? modeles[0];
  const [valeurs, setValeurs] = useState<Valeurs>(() => valeursInitiales(modelesDuCabinet[0], contexte.date));
  // Le texte proposé suit les champs tant que le médecin ne l'a pas retouché à la main
  const propose = composerCertificat(modele, valeurs, contexte);
  const [retouche, setRetouche] = useState<string | null>(null);
  const texte = retouche ?? propose;

  function choisir(nouvelle: string, liste = modeles) {
    const m = liste.find((x) => x.cle === nouvelle)!;
    setCle(nouvelle);
    setValeurs(valeursInitiales(m, contexte.date));
    setRetouche(null);
  }
  // Un modèle qui vient d'être créé, modifié ou supprimé : la liste change et le choix suit
  function modelesChanges(nouveaux: ModelePerso[], choix?: ModelePerso) {
    setPerso(nouveaux);
    if (choix) choisir(`perso:${choix.id}`, [...modelesDuCabinet, ...nouveaux.map(modeleDepuisPerso)]);
    else if (!nouveaux.some((m) => `perso:${m.id}` === cle) && cle.startsWith("perso:")) choisir(modelesDuCabinet[0].cle, modelesDuCabinet);
  }
  const modifier = (nom: string, valeur: string) => {
    setValeurs((v) => ({ ...v, [nom]: valeur }));
    setRetouche(null);
  };

  return (
    <form action={envoyer} className="space-y-5">
      <input type="hidden" name="modele" value={cle} />
      <label className={`${etiquette} block`}>
        Modèle de certificat
        <select value={cle} onChange={(e) => choisir(e.target.value)} className={champ}>
          {groupes.map((g) => (
            <optgroup key={g} label={g}>
              {modeles
                .filter((m) => m.groupe === g)
                .map((m) => (
                  <option key={m.cle} value={m.cle}>
                    {m.libelle}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <GestionModeles
        langue={langue}
        perso={perso}
        texteActuel={texte}
        onChange={modelesChanges}
      />

      {modele.champs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {modele.champs.map((c) => (
            <label key={c.cle} className={`${etiquette} ${c.type === "long" ? "sm:col-span-2" : ""}`}>
              {c.libelle}
              {c.type === "long" ? (
                <textarea
                  name={`champ_${c.cle}`}
                  rows={4}
                  maxLength={3000}
                  value={valeurs[c.cle] ?? ""}
                  onChange={(e) => modifier(c.cle, e.target.value)}
                  placeholder={c.placeholder}
                  className={champ}
                />
              ) : c.type === "choix" ? (
                <select
                  name={`champ_${c.cle}`}
                  value={valeurs[c.cle] ?? ""}
                  onChange={(e) => modifier(c.cle, e.target.value)}
                  className={champ}
                >
                  {c.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={`champ_${c.cle}`}
                  type={c.type === "date" ? "date" : "text"}
                  inputMode={c.type === "nombre" ? "numeric" : undefined}
                  maxLength={300}
                  value={valeurs[c.cle] ?? ""}
                  onChange={(e) => modifier(c.cle, e.target.value)}
                  placeholder={c.placeholder}
                  className={champ}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <label className={`${etiquette} block`}>
        Texte du certificat{" "}
        <span className="font-normal text-slate-400">(relisez et corrigez au besoin avant d&apos;enregistrer)</span>
        <textarea
          name="texte"
          rows={12}
          maxLength={5000}
          value={texte}
          onChange={(e) => setRetouche(e.target.value)}
          className={`${champ} leading-relaxed`}
        />
      </label>
      {retouche !== null && (
        <button type="button" onClick={() => setRetouche(null)} className="text-xs text-slate-600 underline">
          Revenir au texte généré
        </button>
      )}
      {texte.includes("……") && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Des points de suspension (……) restent à compléter dans le texte.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={etiquette}>
          Format de papier
          <select name="format" defaultValue="A5" className={champ}>
            <option value="A5">A5</option>
            <option value="A4">A4</option>
          </select>
        </label>
        <ChoixConsultation consultations={consultations} defaut={consultationDefaut} />
      </div>

      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}
      <BoutonsEnregistrer document="seulement" />
    </form>
  );
}

// Modèles personnels : créer, enregistrer le texte en cours comme modèle, renommer, supprimer — sans quitter la page
function GestionModeles({
  langue,
  perso,
  texteActuel,
  onChange,
}: {
  langue: string;
  perso: ModelePerso[];
  texteActuel: string;
  onChange: (liste: ModelePerso[], choix?: ModelePerso) => void;
}) {
  // « nouveau » : formulaire vide ; « copie » : le texte affiché ; un id : modification
  const [mode, setMode] = useState<null | "nouveau" | "copie" | number>(null);
  const [libelle, setLibelle] = useState("");
  const [corps, setCorps] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [gerer, setGerer] = useState(false);

  function ouvrir(m: "nouveau" | "copie" | number) {
    setErreur("");
    setMode(m);
    if (m === "nouveau") {
      setLibelle("");
      setCorps("");
    } else if (m === "copie") {
      setLibelle("");
      // Seul le corps est repris : l'en-tête et la formule finale sont rajoutés à chaque certificat
      const blocs = texteActuel.split("\n\n");
      setCorps(blocs.length >= 3 ? blocs.slice(1, -1).join("\n\n") : texteActuel);
    } else {
      const existant = perso.find((x) => x.id === m);
      setLibelle(existant?.libelle ?? "");
      setCorps(existant?.texte ?? "");
    }
  }

  async function enregistrer() {
    setEnCours(true);
    setErreur("");
    const resultat =
      typeof mode === "number"
        ? await changerModeleCertificat(langue, mode, libelle, corps)
        : await ajouterModeleCertificat(langue, libelle, corps);
    setEnCours(false);
    if ("erreur" in resultat) {
      setErreur(resultat.erreur);
      return;
    }
    const m = resultat.modele;
    onChange(typeof mode === "number" ? perso.map((x) => (x.id === m.id ? m : x)) : [...perso, m], m);
    setMode(null);
  }

  async function supprimer(m: ModelePerso) {
    if (!confirm(`Supprimer le modèle « ${m.libelle} » ? Les certificats déjà faits ne changent pas.`)) return;
    if (await retirerModeleCertificat(langue, m.id)) onChange(perso.filter((x) => x.id !== m.id));
    else setErreur("Le modèle n'a pas pu être supprimé.");
  }

  const bouton =
    "inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => ouvrir("nouveau")} className={bouton}>
          <Plus className="h-3 w-3" aria-hidden />
          Nouveau modèle
        </button>
        <button type="button" onClick={() => ouvrir("copie")} className={bouton}>
          <BookmarkPlus className="h-3 w-3" aria-hidden />
          Enregistrer ce texte comme modèle
        </button>
        {perso.length > 0 && (
          <button type="button" onClick={() => setGerer((g) => !g)} aria-expanded={gerer} className={bouton}>
            <Pencil className="h-3 w-3" aria-hidden />
            Gérer mes modèles ({perso.length})
          </button>
        )}
      </div>

      {gerer && perso.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {perso.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="text-slate-900">{m.libelle}</span>
              <span className="flex gap-1">
                <button type="button" onClick={() => ouvrir(m.id)} className="rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
                  Modifier
                </button>
                <button type="button" onClick={() => supprimer(m)} className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                  Supprimer
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {mode !== null && (
        <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">
            {typeof mode === "number" ? "Modifier le modèle" : "Nouveau modèle de certificat"}
          </p>
          <p className="text-xs text-slate-500">
            Écrivez le corps du certificat. L&apos;en-tête (« Je soussigné… certifie avoir examiné… ») et la formule finale sont
            ajoutés automatiquement. Laissez des points de suspension (……) là où il faudra compléter.
          </p>
          <label className={`${etiquette} block`}>
            Nom du modèle
            <input
              value={libelle}
              maxLength={100}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex. Certificat de contre-indication au sport"
              className={champ}
            />
          </label>
          <label className={`${etiquette} block`}>
            Texte
            <textarea value={corps} rows={6} maxLength={3000} onChange={(e) => setCorps(e.target.value)} className={champ} />
          </label>
          {erreur && (
            <p role="alert" className="text-sm text-red-800">
              {erreur}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={enregistrer}
              disabled={enCours}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Enregistrer le modèle
            </button>
            <button type="button" onClick={() => setMode(null)} className="rounded-full px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              Annuler
            </button>
          </div>
        </div>
      )}
      {mode === null && erreur && (
        <p role="alert" className="text-sm text-red-800">
          {erreur}
        </p>
      )}
    </div>
  );
}

export function BoutonSupprimerCertificat({ langue, patientId, id }: { langue: string; patientId: number; id: number }) {
  return (
    <form action={retirerCertificat.bind(null, langue, patientId, id)}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm("Supprimer ce certificat ? Sa copie part dans la corbeille de Google Drive.")) e.preventDefault();
        }}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-3 w-3" aria-hidden />
        Supprimer
      </button>
    </form>
  );
}

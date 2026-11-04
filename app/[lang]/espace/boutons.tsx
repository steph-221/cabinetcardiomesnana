"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Ban, Link2, LockOpen, Plus, Search, Trash2, X } from "lucide-react";
import { cabinet } from "../../cabinet";
import type { DossierPropose } from "../../dossier/rendez-vous";
import { ajouter, annuler, chercherDossiers, fermer, rattacher, rouvrir } from "./actions";

export function BoutonAnnuler({ langue, id, nom }: { langue: string; id: string; nom: string }) {
  return (
    <form action={annuler.bind(null, langue, id)}>
      <Envoyer
        confirmation={`Annuler le rendez-vous de ${nom} ? Il sera supprimé de l'agenda.`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Annuler
      </Envoyer>
    </form>
  );
}

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

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// Rattache le rendez-vous au dossier proposé. Ce que le patient a déjà indiqué (date de naissance, e-mail,
// téléphone) complète le dossier là où il est vide ; rien n'est écrasé.
export function BoutonRattacher({
  langue,
  rdvId,
  patientId,
  apport,
  libelle = "Rattacher",
}: {
  langue: string;
  rdvId: string;
  patientId: number;
  apport: { naissance?: string; email?: string; telephone?: string };
  libelle?: string;
}) {
  return (
    <form action={rattacher.bind(null, langue, rdvId, patientId)} className="inline">
      <input type="hidden" name="naissance" value={apport.naissance ?? ""} />
      <input type="hidden" name="email" value={apport.email ?? ""} />
      <input type="hidden" name="telephone" value={apport.telephone ?? ""} />
      <Envoyer className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700">
        <Link2 className="h-3 w-3" aria-hidden />
        {libelle}
      </Envoyer>
    </form>
  );
}

// Pour les rendez-vous pris par téléphone, WhatsApp ou au cabinet
export function FormulaireAjout({ langue, aujourdhui }: { langue: string; aujourdhui: string }) {
  const [etat, envoyer] = useActionState(ajouter.bind(null, langue), null);
  const v = etat?.valeurs ?? {};
  // Dossier existant choisi : ses coordonnées remplissent le formulaire, modifiables
  // undefined = pas de choix de l'utilisateur : après une erreur on reprend ce qui avait été envoyé
  const [choix, setChoix] = useState<number | null | undefined>(undefined);
  const patientId = choix === undefined ? (v.patientId ? Number(v.patientId) : null) : choix;
  const setPatientId = setChoix;
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const valeur = (cle: string) => saisie[cle] ?? v[cle] ?? "";
  const modifier = (cle: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSaisie((s) => ({ ...s, [cle]: e.target.value }));

  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<DossierPropose[] | null>(null);
  const [chargement, demarrer] = useTransition();
  const chercher = () => demarrer(async () => setTrouves(await chercherDossiers(langue, recherche)));
  const choisir = (d: DossierPropose) => {
    setPatientId(d.id);
    setSaisie({ nom: d.nom, prenom: d.prenom, telephone: d.telephone, dateNaissance: d.naissance ?? "", email: d.email });
    setTrouves(null);
    setRecherche("");
  };

  return (
    <form
      action={envoyer}
      // React remet le formulaire à zéro après chaque envoi : les champs contrôlés repartent de ce que renvoie l'action
      onReset={() => {
        setSaisie({});
        setChoix(undefined);
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="sm:col-span-2 lg:col-span-3">
        {patientId ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-900">
            <Link2 className="h-4 w-4" aria-hidden />
            Rendez-vous rattaché au dossier n° {patientId} : {[valeur("prenom"), valeur("nom")].filter(Boolean).join(" ")}
            <button
              type="button"
              onClick={() => setPatientId(null)}
              className="ms-auto inline-flex items-center gap-1 text-xs text-green-800 underline"
            >
              <X className="h-3 w-3" aria-hidden />
              Détacher
            </button>
          </p>
        ) : (
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="rechercheDossier">
              Patient déjà suivi ? <span className="font-normal text-slate-400">(nom, prénom ou téléphone)</span>
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="rechercheDossier"
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    chercher();
                  }
                }}
                className={champ.replace("mt-1 ", "")}
                placeholder="Rechercher un dossier existant"
              />
              <button
                type="button"
                onClick={chercher}
                disabled={chargement || recherche.trim().length < 2}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Search className="h-4 w-4" aria-hidden />
                Chercher
              </button>
            </div>
            {trouves && (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                {trouves.length === 0 && <li className="p-3 text-slate-500">Aucun dossier trouvé : saisissez le patient ci-dessous.</li>}
                {trouves.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => choisir(d)} className="flex w-full flex-wrap justify-between gap-2 p-3 text-start hover:bg-slate-50">
                      <span className="font-medium text-slate-900">
                        {d.nom.toUpperCase()} {d.prenom} <span className="font-normal text-slate-400">n° {d.id}</span>
                      </span>
                      <span className="text-slate-500">
                        {[d.naissance && d.naissance.split("-").reverse().join("/"), d.telephone].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <input type="hidden" name="patientId" value={patientId ?? ""} />
      </div>
      <label className="text-sm font-medium text-slate-700">
        Date
        <input name="jour" type="date" required min={aujourdhui} defaultValue={v.jour ?? aujourdhui} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Heure
        <input name="heure" type="time" required step={300} defaultValue={v.heure} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Type
        <select name="type" defaultValue={v.type ?? "consultation"} className={champ}>
          <option value="consultation">Consultation ({cabinet.dureeRdv} min)</option>
          <option value="controle">Contrôle ({cabinet.dureeControle} min)</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Durée <span className="font-normal text-slate-400">(minutes, si différente)</span>
        <input name="duree" type="number" min={5} max={240} step={5} defaultValue={v.duree} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Prénom
        <input name="prenom" maxLength={100} value={valeur("prenom")} onChange={modifier("prenom")} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Nom
        <input name="nom" required maxLength={100} value={valeur("nom")} onChange={modifier("nom")} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Téléphone
        <input name="telephone" type="tel" maxLength={30} value={valeur("telephone")} onChange={modifier("telephone")} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Date de naissance
        <input name="dateNaissance" type="date" min="1900-01-01" value={valeur("dateNaissance")} onChange={modifier("dateNaissance")} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        E-mail
        <input name="email" type="email" maxLength={100} value={valeur("email")} onChange={modifier("email")} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2 lg:col-span-3">
        Motif
        <input name="motif" maxLength={300} defaultValue={v.motif} className={champ} />
      </label>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2 lg:col-span-3">
          {etat.erreur}
        </p>
      )}
      <div className="sm:col-span-2 lg:col-span-3">
        <Envoyer className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter le rendez-vous
        </Envoyer>
      </div>
    </form>
  );
}

export function BoutonRouvrir({ langue, id }: { langue: string; id: string }) {
  return (
    <form action={rouvrir.bind(null, langue, id)}>
      <Envoyer
        confirmation="Rouvrir ces créneaux à la réservation en ligne ?"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
      >
        <LockOpen className="h-4 w-4" aria-hidden />
        Rouvrir
      </Envoyer>
    </form>
  );
}

// Congé, absence… : rend des journées ou une plage horaire indisponibles sur le site
export function FormulaireFermeture({ langue, aujourdhui }: { langue: string; aujourdhui: string }) {
  const [etat, envoyer] = useActionState(fermer.bind(null, langue), null);
  const v = etat?.valeurs ?? {};

  // Les heures ne s'affichent que si « Journée entière » est décochée (en CSS : reste juste après
  // la remise à zéro automatique du formulaire)
  return (
    <form action={envoyer} className="group grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">
        Du
        <input
          name="jourDebut"
          type="date"
          required
          min={aujourdhui}
          defaultValue={v.jourDebut ?? aujourdhui}
          className={champ}
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Au <span className="font-normal text-slate-400">(laisser vide pour un seul jour)</span>
        <input name="jourFin" type="date" min={aujourdhui} defaultValue={v.jourFin} className={champ} />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input type="checkbox" name="journeeEntiere" defaultChecked={etat ? v.journeeEntiere === "on" : true} />
        Journée entière
      </label>
      <label className="text-sm font-medium text-slate-700 group-has-[[name=journeeEntiere]:checked]:hidden">
        De
        <input name="heureDebut" type="time" step={300} defaultValue={v.heureDebut} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700 group-has-[[name=journeeEntiere]:checked]:hidden">
        À
        <input name="heureFin" type="time" step={300} defaultValue={v.heureFin} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Motif <span className="font-normal text-slate-400">(facultatif, visible seulement par le cabinet)</span>
        <input name="motif" maxLength={100} placeholder="Congés, formation…" defaultValue={v.motif} className={champ} />
      </label>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
          {etat.erreur}
        </p>
      )}
      <div className="sm:col-span-2">
        <Envoyer className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800">
          <Ban className="h-4 w-4" aria-hidden />
          Fermer ces créneaux
        </Envoyer>
      </div>
    </form>
  );
}

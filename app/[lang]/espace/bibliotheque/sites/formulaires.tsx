"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Copy, Eye, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { typesSource } from "../../../../dossier/sources";
import {
  afficherMotDePasse,
  enregistrerAccesSite,
  retirerSite,
  suivreEsc,
  suivreSite,
  toutVerifier,
  verifier,
} from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const petit = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50";

function Envoyer({ children, className, attente }: { children: React.ReactNode; className: string; attente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {pending && attente ? attente : children}
    </button>
  );
}

function Erreur({ texte }: { texte?: string }) {
  return texte ? (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
      {texte}
    </p>
  ) : null;
}

export function SuivreEsc({ langue }: { langue: string }) {
  const [etat, envoyer] = useActionState(suivreEsc.bind(null, langue), null);
  return (
    <form action={envoyer} className="space-y-2">
      <Envoyer
        attente="Lecture de la liste de l'ESC…"
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Suivre toutes les recommandations de l&apos;ESC
      </Envoyer>
      <Erreur texte={etat?.erreur} />
    </form>
  );
}

export function FormulaireSite({ langue }: { langue: string }) {
  const [etat, envoyer] = useActionState(suivreSite.bind(null, langue), null);
  const v = etat?.valeurs ?? {};
  return (
    <form action={envoyer} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">
        Nom
        <input
          name="nom"
          required
          maxLength={120}
          defaultValue={v.nom}
          placeholder="European Heart Journal"
          className={champ}
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Organisme ou revue
        <input name="organisme" maxLength={100} defaultValue={v.organisme} placeholder="EHJ" className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Adresse de la page qui liste les publications, ou du flux RSS de la revue
        <input name="adresse" type="url" required maxLength={500} defaultValue={v.adresse} className={champ} />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Pour une revue, cherchez « RSS » sur son site (dernier numéro, articles en ligne en avance…).
        </span>
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Ne garder que les liens qui commencent par (facultatif, pages de liste seulement)
        <input name="prefixe" type="url" maxLength={500} defaultValue={v.prefixe} className={champ} />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Par défaut, les liens qui prolongent l&apos;adresse de la page de liste.
        </span>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Type de publications
        <select name="type" defaultValue={v.type ?? "article"} className={champ}>
          {typesSource
            .filter((t) => t.cle !== "fiche")
            .map((t) => (
              <option key={t.cle} value={t.cle}>
                {t.libelle}
              </option>
            ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Langue
        <select name="langueSource" defaultValue={v.langueSource ?? "en"} className={champ}>
          <option value="en">Anglais</option>
          <option value="fr">Français</option>
        </select>
      </label>
      <div className="sm:col-span-2">
        <Envoyer
          attente="Lecture du site…"
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Suivre ce site
        </Envoyer>
      </div>
      <Erreur texte={etat?.erreur} />
    </form>
  );
}

export function ToutVerifier({ langue }: { langue: string }) {
  return (
    <form action={toutVerifier.bind(null, langue)}>
      <Envoyer attente="Vérification…" className={`${petit} border border-slate-300 text-slate-700`}>
        <RefreshCw className="h-3 w-3" aria-hidden />
        Vérifier les nouveautés
      </Envoyer>
    </form>
  );
}

export function BoutonsSite({ langue, id, nom }: { langue: string; id: number; nom: string }) {
  const [message, setMessage] = useState("");
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={enCours}
        className={`${petit} text-slate-700`}
        onClick={() =>
          demarrer(async () => {
            const r = await verifier(langue, id);
            setMessage(
              "erreur" in r ? r.erreur : r.nouvelles ? `${r.nouvelles} nouvelle(s) publication(s)` : "Rien de nouveau",
            );
          })
        }
      >
        <RefreshCw className={`h-3 w-3 ${enCours ? "animate-spin" : ""}`} aria-hidden />
        Vérifier
      </button>
      <form
        action={retirerSite.bind(null, langue, id)}
        onSubmit={(e) => {
          if (!confirm(`Ne plus suivre « ${nom} » ? Les sources déjà ajoutées à la bibliothèque restent.`)) {
            e.preventDefault();
          }
        }}
      >
        <Envoyer className={`${petit} text-red-700 hover:bg-red-50`}>
          <Trash2 className="h-3 w-3" aria-hidden />
          Ne plus suivre
        </Envoyer>
      </form>
      {message && (
        <span role="status" className="text-xs text-slate-500">
          {message}
        </span>
      )}
    </div>
  );
}

// Accès abonné : page de connexion, identifiant et mot de passe (chiffrés dans la base)
export function AccesAbonne({
  langue,
  id,
  accesUrl,
  identifiant,
  motDePasse,
}: {
  langue: string;
  id: number;
  accesUrl: string;
  identifiant: string;
  motDePasse: boolean;
}) {
  const [etat, envoyer] = useActionState(enregistrerAccesSite.bind(null, langue, id), null);
  const [visible, setVisible] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const copier = (t: string) => navigator.clipboard?.writeText(t).catch(() => {});

  return (
    <details className="mt-3 rounded-lg border border-slate-200 p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 text-slate-700">
        <KeyRound className="h-4 w-4 text-slate-500" aria-hidden />
        Accès abonné {identifiant || motDePasse ? "(enregistré)" : ""}
      </summary>
      {(identifiant || motDePasse) && (
        <div className="mt-3 space-y-1 rounded-md bg-slate-50 p-3">
          {accesUrl && (
            <p>
              <a href={accesUrl} target="_blank" rel="noopener noreferrer" className="text-red-700 underline">
                Ouvrir la page de connexion
              </a>
            </p>
          )}
          {identifiant && (
            <p className="flex flex-wrap items-center gap-2">
              Identifiant : <code className="rounded bg-white px-1">{identifiant}</code>
              <button type="button" className={`${petit} text-slate-700`} onClick={() => copier(identifiant)}>
                <Copy className="h-3 w-3" aria-hidden />
                Copier
              </button>
            </p>
          )}
          {motDePasse && (
            <p className="flex flex-wrap items-center gap-2">
              Mot de passe :{" "}
              {visible === null ? (
                <button
                  type="button"
                  disabled={enCours}
                  className={`${petit} text-slate-700`}
                  onClick={() => demarrer(async () => setVisible((await afficherMotDePasse(langue, id)) ?? ""))}
                >
                  <Eye className="h-3 w-3" aria-hidden />
                  Afficher
                </button>
              ) : (
                <>
                  <code className="rounded bg-white px-1">{visible}</code>
                  <button type="button" className={`${petit} text-slate-700`} onClick={() => copier(visible)}>
                    <Copy className="h-3 w-3" aria-hidden />
                    Copier
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      )}
      <form action={envoyer} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Page de connexion
          <input name="accesUrl" type="url" maxLength={500} defaultValue={accesUrl} className={champ} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Identifiant
          <input name="identifiant" maxLength={200} autoComplete="off" defaultValue={identifiant} className={champ} />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Mot de passe
          <input
            name="motDePasse"
            type="password"
            maxLength={200}
            autoComplete="new-password"
            placeholder={motDePasse ? "inchangé" : ""}
            className={champ}
          />
        </label>
        {motDePasse && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="effacer" />
            Effacer le mot de passe enregistré
          </label>
        )}
        <div className="sm:col-span-2">
          <Envoyer className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Enregistrer l&apos;accès
          </Envoyer>
        </div>
        <Erreur texte={etat?.erreur} />
      </form>
    </details>
  );
}

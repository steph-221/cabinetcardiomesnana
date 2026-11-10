"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BookPlus, Mic, Square, X } from "lucide-react";
import {
  abonner,
  apprendreMot,
  arreterDictee,
  dicterDans,
  effacerErreur,
  estDictable,
  lireEtat,
  lireEtatServeur,
  reglerLexique,
  releverCorrections,
  retirerProposition,
  type Champ,
} from "../../../voix/dictee-champ";
import { ajouterAuLexique } from "../lexique/actions";
import { NoteVocale } from "./note-vocale";

export const useDictee = () => useSyncExternalStore(abonner, lireEtat, lireEtatServeur);

// La voix dans tout l'espace cabinet : un micro apparaît sur le champ de texte où l'on écrit (Ctrl+M pour dicter
// sans la souris), un bandeau montre la dictée en cours, et les médecins ont la note vocale.
export function Voix({
  langue,
  medical,
  lexique,
}: {
  langue: string;
  medical: boolean;
  lexique: { entendu: string; correct: string }[];
}) {
  const dictee = useDictee();
  const chemin = usePathname();
  const [champ, setChamp] = useState<Champ | null>(null);
  const [position, setPosition] = useState<{ haut: number; gauche: number } | null>(null);
  const [note, setNote] = useState(false);

  useEffect(() => {
    reglerLexique(lexique);
  }, [lexique]);
  // Changer de page arrête la dictée en cours
  useEffect(() => arreterDictee, [chemin]);

  useEffect(() => {
    const entree = (e: FocusEvent) => setChamp(estDictable(e.target as Element) ? (e.target as Champ) : null);
    const sortie = () => setTimeout(() => !estDictable(document.activeElement) && setChamp(null), 0);
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lireEtat().cible) return arreterDictee();
      if (!e.ctrlKey || e.altKey || e.metaKey || e.key.toLowerCase() !== "m") return;
      e.preventDefault();
      const actif = document.activeElement;
      if (lireEtat().cible) arreterDictee();
      else if (estDictable(actif)) dicterDans(actif);
      else if (medical) setNote(true);
    };
    const envoi = (e: SubmitEvent) => {
      if (e.target instanceof HTMLFormElement) releverCorrections(e.target);
    };
    document.addEventListener("focusin", entree);
    document.addEventListener("focusout", sortie);
    document.addEventListener("keydown", touche, true);
    document.addEventListener("submit", envoi, true);
    return () => {
      document.removeEventListener("focusin", entree);
      document.removeEventListener("focusout", sortie);
      document.removeEventListener("keydown", touche, true);
      document.removeEventListener("submit", envoi, true);
    };
  }, [medical]);

  // Le micro suit le coin du champ, y compris quand la page défile
  const repere = champ ?? dictee.cible;
  useLayoutEffect(() => {
    if (!repere) return;
    const placer = () => {
      if (!repere.isConnected) return setPosition(null);
      const r = repere.getBoundingClientRect();
      setPosition({ haut: r.top + 4, gauche: r.right - 32 });
    };
    placer();
    window.addEventListener("scroll", placer, true);
    window.addEventListener("resize", placer);
    return () => {
      window.removeEventListener("scroll", placer, true);
      window.removeEventListener("resize", placer);
    };
  }, [repere]);

  const enCours = Boolean(dictee.cible);

  return (
    <div lang="fr" dir="ltr">
      {repere && position && repere.isConnected && (
        <button
          type="button"
          // Garde le curseur dans le champ : le texte dicté s'insère là où il se trouve
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => dicterDans(repere)}
          aria-label={dictee.cible === repere ? "Terminer la dictée" : "Dicter dans ce champ (Ctrl+M)"}
          title={dictee.cible === repere ? "Terminer la dictée (Ctrl+M)" : "Dicter dans ce champ (Ctrl+M)"}
          style={{ top: position.haut, left: position.gauche }}
          className={`fixed z-50 inline-flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${
            dictee.cible === repere
              ? "animate-pulse bg-red-600 text-white"
              : "border border-slate-300 bg-white text-slate-500 hover:border-red-400 hover:text-red-700"
          }`}
        >
          {dictee.cible === repere ? <Square className="h-3 w-3" aria-hidden /> : <Mic className="h-3.5 w-3.5" aria-hidden />}
        </button>
      )}

      {enCours && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(40rem,calc(100%-2rem))] items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-medium">Dictée{dictee.libelle ? ` — ${dictee.libelle}` : ""}</span>
            <span className="block truncate text-slate-300" dir="auto">
              {dictee.provisoire || "Parlez : « virgule », « point », « à la ligne » sont compris."}
            </span>
          </p>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={arreterDictee}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-900"
          >
            <Square className="h-3 w-3" aria-hidden />
            Terminer
          </button>
        </div>
      )}

      {dictee.erreur && !enCours && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(40rem,calc(100%-2rem))] items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg ring-1 ring-amber-200"
        >
          <p className="flex-1">{dictee.erreur}</p>
          <button type="button" onClick={effacerErreur} aria-label="Fermer" className="rounded-md p-1 hover:bg-amber-100">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {medical && dictee.propositions.length > 0 && !enCours && (
        <div className="fixed bottom-4 left-4 z-40 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-lg">
          <p className="font-medium text-slate-900">Mots corrigés après la dictée</p>
          <p className="text-xs text-slate-500">Les retenir pour les prochaines dictées ?</p>
          <ul className="mt-2 space-y-2">
            {dictee.propositions.map((p) => (
              <li key={p.entendu} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-700">
                  « {p.entendu} » → <strong>{p.correct}</strong>
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (await ajouterAuLexique(langue, p.entendu, p.correct)) apprendreMot(p.entendu, p.correct);
                      retirerProposition(p.entendu);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    <BookPlus className="h-3 w-3" aria-hidden />
                    Retenir
                  </button>
                  <button
                    type="button"
                    onClick={() => retirerProposition(p.entendu)}
                    className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                  >
                    Ignorer
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {medical && <NoteVocale langue={langue} ouverte={note} ouvrir={setNote} masquee={enCours && !note} />}
    </div>
  );
}

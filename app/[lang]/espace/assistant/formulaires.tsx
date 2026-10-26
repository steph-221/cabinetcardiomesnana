"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BookmarkPlus, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { enFiche, noterReponse, poserQuestion } from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

function Envoyer({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}

function Attente() {
  const { pending } = useFormStatus();
  return pending ? (
    <span role="status" className="text-sm text-slate-600">
      Recherche dans la bibliothèque et rédaction de la réponse (jusqu&apos;à une minute)…
    </span>
  ) : null;
}

const exemples = [
  "Dose d'apixaban dans la FA selon l'âge, le poids et la créatinine ?",
  "INR cible pour une valve aortique mécanique ?",
  "Quand passer au sacubitril/valsartan dans l'IC à FEVG réduite ?",
];

export function FormulaireQuestion({ langue, patientId }: { langue: string; patientId: number | null }) {
  const [etat, envoyer] = useActionState(poserQuestion.bind(null, langue), null);
  return (
    <form action={envoyer} className="space-y-3">
      {patientId && <input type="hidden" name="patient" value={patientId} />}
      <label className="block text-sm font-medium text-slate-700">
        Question
        <textarea
          name="question"
          required
          minLength={5}
          maxLength={2000}
          rows={3}
          defaultValue={etat?.valeurs.question}
          placeholder={exemples[0]}
          className={champ}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Envoyer className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          <Send className="h-4 w-4" aria-hidden />
          Demander
        </Envoyer>
        <Attente />
      </div>
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}
      <p className="text-xs text-slate-500">Exemples : {exemples.join(" · ")}</p>
    </form>
  );
}

export function Notation({
  langue,
  id,
  note,
  commentaire,
  fiche,
  peutFaireFiche,
}: {
  langue: string;
  id: number;
  note: -1 | 1 | null;
  commentaire: string;
  fiche: boolean;
  peutFaireFiche: boolean;
}) {
  const bouton = "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm";
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap items-end gap-2">
        <label className="min-w-60 flex-1 text-sm font-medium text-slate-700">
          Commentaire (facultatif)
          <input name="commentaire" maxLength={1000} defaultValue={commentaire} className={champ} />
        </label>
        <button
          type="submit"
          formAction={noterReponse.bind(null, langue, id, 1)}
          className={`${bouton} ${note === 1 ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden />
          Juste
        </button>
        <button
          type="submit"
          formAction={noterReponse.bind(null, langue, id, -1)}
          className={`${bouton} ${note === -1 ? "border-red-600 bg-red-50 text-red-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
        >
          <ThumbsDown className="h-4 w-4" aria-hidden />À revoir
        </button>
      </form>
      {fiche ? (
        <p className="text-sm text-emerald-700">Cette réponse est une fiche validée de la bibliothèque.</p>
      ) : (
        peutFaireFiche && (
          <form action={enFiche.bind(null, langue, id)}>
            <Envoyer className={`${bouton} border-slate-300 text-slate-700 hover:bg-slate-50`}>
              <BookmarkPlus className="h-4 w-4" aria-hidden />
              Valider et ajouter à la bibliothèque
            </Envoyer>
          </form>
        )
      )}
    </div>
  );
}

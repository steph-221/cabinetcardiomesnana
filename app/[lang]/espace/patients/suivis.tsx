"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CalendarPlus, MessageCircle, RotateCcw, Send, Trash2 } from "lucide-react";
import { effacerSuivi, nouveauSuivi, statutSuivi } from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-sm font-medium text-slate-700";

export type Choix = { quoi: string[]; delais: { libelle: string; jours: number }[] };

// Champs « quoi » + délai ou date : servent seuls ou à la fin du formulaire de consultation
export function ChampsSuivi({ choix, valeurs = {} }: { choix: Choix; valeurs?: Record<string, string> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
      <label className={etiquette}>
        À prévoir
        <input
          name="suiviQuoi"
          list="suivis-courants"
          maxLength={150}
          placeholder="Échocardiographie (ETT)"
          defaultValue={valeurs.suiviQuoi}
          className={champ}
        />
        <datalist id="suivis-courants">
          {choix.quoi.map((q) => (
            <option key={q} value={q} />
          ))}
        </datalist>
      </label>
      <label className={etiquette}>
        Dans
        <select name="suiviDelai" defaultValue={valeurs.suiviDelai ?? "91"} className={champ}>
          {choix.delais.map((d) => (
            <option key={d.jours} value={d.jours}>
              {d.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className={etiquette}>
        Ou le <span className="font-normal text-slate-400">(date précise)</span>
        <input name="suiviDate" type="date" defaultValue={valeurs.suiviDate} className={champ} />
      </label>
    </div>
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

export function FormulaireSuivi({ langue, patientId, choix }: { langue: string; patientId: number; choix: Choix }) {
  const [etat, envoyer] = useActionState(nouveauSuivi.bind(null, langue, patientId), null);
  return (
    <form action={envoyer} className="space-y-3">
      <ChampsSuivi choix={choix} valeurs={etat?.valeurs} />
      {etat && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {etat.erreur}
        </p>
      )}
      <Envoyer className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        <CalendarPlus className="h-4 w-4" aria-hidden />
        Prévoir
      </Envoyer>
    </form>
  );
}

const petit = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs";

export function ActionsSuivi({
  langue,
  patientId,
  id,
  statut,
  whatsapp,
}: {
  langue: string;
  patientId: number;
  id: number;
  statut: "a_faire" | "relance" | "fait";
  whatsapp: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {statut !== "fait" && whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={`${petit} text-green-700 hover:bg-green-50`}
        >
          <MessageCircle className="h-3 w-3" aria-hidden />
          Message WhatsApp
        </a>
      )}
      {statut === "a_faire" && (
        <form action={statutSuivi.bind(null, langue, patientId, id, "relance")}>
          <Envoyer className={`${petit} text-slate-700 hover:bg-slate-100`}>
            <Send className="h-3 w-3" aria-hidden />
            Relancé
          </Envoyer>
        </form>
      )}
      {statut !== "fait" ? (
        <form action={statutSuivi.bind(null, langue, patientId, id, "fait")}>
          <Envoyer className={`${petit} text-slate-700 hover:bg-slate-100`}>
            <Check className="h-3 w-3" aria-hidden />
            Fait
          </Envoyer>
        </form>
      ) : (
        <form action={statutSuivi.bind(null, langue, patientId, id, "a_faire")}>
          <Envoyer className={`${petit} text-slate-500 hover:bg-slate-100`}>
            <RotateCcw className="h-3 w-3" aria-hidden />
            Rouvrir
          </Envoyer>
        </form>
      )}
      <form action={effacerSuivi.bind(null, langue, patientId, id)}>
        <Envoyer confirmation="Supprimer ce suivi ?" className={`${petit} text-red-700 hover:bg-red-50`}>
          <Trash2 className="h-3 w-3" aria-hidden />
          Supprimer
        </Envoyer>
      </form>
    </div>
  );
}

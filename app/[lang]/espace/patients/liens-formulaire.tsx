"use client";

import { useState, useTransition } from "react";
import { Link2, Unlink } from "lucide-react";
import { rattacherElement } from "./actions";

// Détache un élément de sa consultation : il reste dans le dossier du patient
export function BoutonDetacher({
  langue,
  patientId,
  type,
  id,
}: {
  langue: string;
  patientId: number;
  type: string;
  id: number;
}) {
  const [enCours, transition] = useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => transition(() => rattacherElement(langue, patientId, type, id, null))}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60"
    >
      <Unlink className="h-3 w-3" aria-hidden />
      Détacher
    </button>
  );
}

export type ChoixRattachement = { valeur: string; libelle: string; groupe: string };

// Rattache à cette consultation un élément du dossier qui n'est encore rattaché à aucune
export function RattacherExistant({
  langue,
  patientId,
  consultationId,
  choix,
}: {
  langue: string;
  patientId: number;
  consultationId: number;
  choix: ChoixRattachement[];
}) {
  const [valeur, setValeur] = useState("");
  const [enCours, transition] = useTransition();
  const groupes = [...new Set(choix.map((c) => c.groupe))];
  if (!choix.length) return <p className="text-xs text-slate-500">Rien d&apos;autre à rattacher dans ce dossier.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        aria-label="Élément du dossier à rattacher"
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        <option value="">Rattacher un élément du dossier…</option>
        {groupes.map((g) => (
          <optgroup key={g} label={g}>
            {choix
              .filter((c) => c.groupe === g)
              .map((c) => (
                <option key={c.valeur} value={c.valeur}>
                  {c.libelle}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <button
        type="button"
        disabled={!valeur || enCours}
        onClick={() => {
          const [type, id] = valeur.split(":");
          transition(async () => {
            await rattacherElement(langue, patientId, type, Number(id), consultationId);
            setValeur("");
          });
        }}
        className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden />
        Rattacher
      </button>
    </div>
  );
}

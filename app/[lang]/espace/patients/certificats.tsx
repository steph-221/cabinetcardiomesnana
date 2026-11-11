"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileCheck, Trash2 } from "lucide-react";
import {
  composerCertificat,
  groupesModeles,
  modeles,
  valeursInitiales,
  type ContexteCertificat,
  type Valeurs,
} from "../../../dossier/certificats-modeles";
import type { OptionConsultation } from "../../../dossier/choix-consultation";
import { nouveauCertificat, retirerCertificat } from "./actions-documents";
import { ChoixConsultation } from "./choix-consultation";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-sm font-medium text-slate-700";

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

export function FormulaireCertificat({
  langue,
  patientId,
  contexte,
  consultations,
  consultationDefaut,
}: {
  langue: string;
  patientId: number;
  contexte: ContexteCertificat;
  consultations: OptionConsultation[];
  consultationDefaut?: number;
}) {
  const [etat, envoyer] = useActionState(nouveauCertificat.bind(null, langue, patientId), null);
  const [cle, setCle] = useState(modeles[0].cle);
  const modele = modeles.find((m) => m.cle === cle)!;
  const [valeurs, setValeurs] = useState<Valeurs>(() => valeursInitiales(modeles[0], contexte.date));
  // Le texte proposé suit les champs tant que le médecin ne l'a pas retouché à la main
  const propose = composerCertificat(modele, valeurs, contexte);
  const [retouche, setRetouche] = useState<string | null>(null);
  const texte = retouche ?? propose;

  function choisir(nouvelle: string) {
    const m = modeles.find((x) => x.cle === nouvelle)!;
    setCle(nouvelle);
    setValeurs(valeursInitiales(m, contexte.date));
    setRetouche(null);
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
          {groupesModeles.map((g) => (
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

      {modele.champs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {modele.champs.map((c) => (
            <label key={c.cle} className={`${etiquette} ${c.type === "long" ? "sm:col-span-2" : ""}`}>
              {c.libelle}
              {c.type === "long" ? (
                <textarea
                  name={`champ_${c.cle}`}
                  rows={4}
                  maxLength={1000}
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
      <Envoyer>Enregistrer le certificat</Envoyer>
    </form>
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

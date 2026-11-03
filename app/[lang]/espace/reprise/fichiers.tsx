"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { EyeOff, FileText, Trash2 } from "lucide-react";
import { FichierIllisible, texteWord } from "../../../dossier/word";
import { analyserFichier, ignorerImport, importerExtractions, retirerImport } from "./actions";

type Etat = { nom: string; message: string; erreur?: boolean };

// Les fichiers sont lus un par un sur cet ordinateur ; seul leur texte est envoyé
export function ChoixFichiers({ langue }: { langue: string }) {
  const router = useRouter();
  const [etats, setEtats] = useState<Etat[]>([]);
  const [occupe, setOccupe] = useState(false);

  async function lire(fichiers: File[]) {
    setOccupe(true);
    const suivi: Etat[] = fichiers.map((f) => ({ nom: f.name, message: "En attente…" }));
    const maj = (i: number, e: Partial<Etat>) => {
      suivi[i] = { ...suivi[i], ...e };
      setEtats([...suivi]);
    };
    setEtats([...suivi]);
    for (const [i, f] of fichiers.entries()) {
      maj(i, { message: "Lecture…" });
      let contenu: string;
      try {
        contenu = texteWord(new Uint8Array(await f.arrayBuffer()));
      } catch (erreur) {
        maj(i, {
          erreur: true,
          message:
            erreur instanceof FichierIllisible && erreur.message === "format"
              ? "Ancien format Word (.doc) : ouvrez-le dans Word et enregistrez-le au format .docx."
              : "Fichier illisible.",
        });
        continue;
      }
      maj(i, { message: "Analyse du contenu…" });
      try {
        const r = await analyserFichier(langue, f.name, contenu);
        maj(
          i,
          "erreur" in r ? { erreur: true, message: r.erreur } : { message: r.deja ? "Déjà lu." : "Prêt à valider." },
        );
      } catch {
        maj(i, { erreur: true, message: "L'analyse a échoué. Réessayez dans un instant." });
      }
    }
    setOccupe(false);
    router.refresh();
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        Comptes rendus Word (.docx), un ou plusieurs
        <input
          type="file"
          multiple
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={occupe}
          onChange={(e) => {
            const fichiers = [...(e.currentTarget.files ?? [])];
            e.currentTarget.value = "";
            if (fichiers.length) lire(fichiers);
          }}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 file:me-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-1.5 file:text-sm file:text-white disabled:opacity-50"
        />
      </label>
      {etats.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm" aria-live="polite">
          {etats.map((e, i) => (
            <li key={i} className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span className="min-w-0">
                <span className="font-medium text-slate-800">{e.nom}</span>
                <span className={`ms-2 ${e.erreur ? "text-red-700" : "text-slate-500"}`}>{e.message}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Fichier d'extraction (.json) préparé hors de l'app, par exemple par Claude Code : il alimente la file « à valider »
export function ChoixExtraction({ langue }: { langue: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function envoyer(fichier: File) {
    setOccupe(true);
    setMessage(null);
    try {
      const r = await importerExtractions(langue, await fichier.text());
      setMessage(
        "erreur" in r
          ? { texte: r.erreur, erreur: true }
          : { texte: `${r.ajoutes} ajouté(s) à valider, ${r.deja} déjà lu(s), ${r.ignores} ignoré(s).` },
      );
      router.refresh();
    } catch {
      setMessage({ texte: "L'import a échoué. Réessayez dans un instant.", erreur: true });
    }
    setOccupe(false);
  }

  return (
    <div className="mt-6 border-t border-slate-100 pt-6">
      <label className="block text-sm font-medium text-slate-700">
        Fichier d&apos;extraction (.json), préparé hors de l&apos;app
        <input
          type="file"
          accept=".json,application/json"
          disabled={occupe}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (f) envoyer(f);
          }}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 file:me-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-1.5 file:text-sm file:text-white disabled:opacity-50"
        />
      </label>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.erreur ? "text-red-700" : "text-slate-600"}`}>
          {message.texte}
        </p>
      )}
    </div>
  );
}

function Envoyer({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}

const petit = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100";

export function BoutonsImport({ langue, id, aValider }: { langue: string; id: number; aValider: boolean }) {
  return (
    <div className="flex shrink-0 gap-1">
      {aValider && (
        <form action={ignorerImport.bind(null, langue, id)}>
          <Envoyer className={`${petit} text-slate-700`}>
            <EyeOff className="h-3 w-3" aria-hidden />
            Ignorer
          </Envoyer>
        </form>
      )}
      <form
        action={retirerImport.bind(null, langue, id)}
        onSubmit={(e) => {
          if (!confirm("Retirer ce compte rendu de la liste ? Le dossier éventuellement créé est conservé.")) {
            e.preventDefault();
          }
        }}
      >
        <Envoyer className={`${petit} text-red-700 hover:bg-red-50`}>
          <Trash2 className="h-3 w-3" aria-hidden />
          Retirer
        </Envoyer>
      </form>
    </div>
  );
}

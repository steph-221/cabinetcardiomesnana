"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FileUp, LoaderCircle, Save, Trash2, XCircle } from "lucide-react";
import { changerConclusion, retirerExamen } from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const etiquette = "text-sm font-medium text-slate-700";

type Envoi = { nom: string; etat: "en cours" | "fait" | "erreur"; message?: string };

// Réduit une photo de téléphone (souvent 3 à 8 Mo) à une image JPEG lisible d'environ 500 Ko
async function preparer(fichier: File): Promise<File> {
  if (!fichier.type.startsWith("image/") || (fichier.type === "image/jpeg" && fichier.size < 1_500_000)) return fichier;
  try {
    const image = await createImageBitmap(fichier);
    const echelle = Math.min(1, 2200 / Math.max(image.width, image.height));
    const toile = document.createElement("canvas");
    toile.width = Math.round(image.width * echelle);
    toile.height = Math.round(image.height * echelle);
    toile.getContext("2d")!.drawImage(image, 0, 0, toile.width, toile.height);
    const blob = await new Promise<Blob | null>((r) => toile.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return fichier;
    return new File([blob], fichier.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return fichier; // format illisible par ce navigateur : le serveur expliquera le refus
  }
}

export function EnvoiExamens({
  patientId,
  types,
  medical,
  tailleMax,
  aujourdhui,
}: {
  patientId: number;
  types: string[];
  medical: boolean;
  tailleMax: number;
  aujourdhui: string;
}) {
  const router = useRouter();
  const formulaire = useRef<HTMLFormElement>(null);
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [survol, setSurvol] = useState(false);
  const enCours = envois.some((e) => e.etat === "en cours");

  async function envoyer(fichiers: File[]) {
    if (!fichiers.length || !formulaire.current) return;
    const donnees = new FormData(formulaire.current);
    const liste: Envoi[] = fichiers.map((f) => ({ nom: f.name, etat: "en cours" }));
    setEnvois(liste);
    const maj = (i: number, e: Partial<Envoi>) =>
      setEnvois((avant) => avant.map((x, j) => (j === i ? { ...x, ...e } : x)));

    // Un fichier à la fois : chaque envoi reste sous la limite de taille
    for (const [i, brut] of fichiers.entries()) {
      const fichier = await preparer(brut);
      if (fichier.size > tailleMax) {
        maj(i, { etat: "erreur", message: "dépasse 4 Mo" });
        continue;
      }
      const corps = new FormData();
      corps.set("patient", String(patientId));
      for (const cle of ["type", "date", "conclusion"]) corps.set(cle, String(donnees.get(cle) ?? ""));
      corps.set("fichier", fichier);
      try {
        const reponse = await fetch("/api/examens", { method: "POST", body: corps });
        const resultat = (await reponse.json().catch(() => ({}))) as { erreur?: string };
        maj(i, reponse.ok ? { etat: "fait" } : { etat: "erreur", message: resultat.erreur ?? "erreur" });
      } catch {
        maj(i, { etat: "erreur", message: "pas de connexion" });
      }
    }
    const conclusion = formulaire.current.elements.namedItem("conclusion");
    if (conclusion instanceof HTMLTextAreaElement) conclusion.value = "";
    router.refresh();
  }

  const choisir = (e: React.ChangeEvent<HTMLInputElement>) => {
    envoyer([...(e.target.files ?? [])]);
    e.target.value = "";
  };

  return (
    <form
      ref={formulaire}
      onSubmit={(e) => e.preventDefault()}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        if (!enCours) envoyer([...e.dataTransfer.files]);
      }}
      className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
        survol ? "border-red-400 bg-red-50" : "border-slate-200"
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={etiquette}>
          Type d&apos;examen
          <select name="type" defaultValue={types[0]} className={champ}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className={etiquette}>
          Date de l&apos;examen
          <input name="date" type="date" required max={aujourdhui} defaultValue={aujourdhui} className={champ} />
        </label>
        {medical && (
          <label className={`${etiquette} sm:col-span-2`}>
            Conclusion <span className="font-normal text-slate-400">(facultatif, peut être ajoutée plus tard)</span>
            <textarea name="conclusion" rows={2} maxLength={5000} className={champ} />
          </label>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 ${enCours ? "pointer-events-none opacity-50" : ""}`}
        >
          <FileUp className="h-4 w-4" aria-hidden />
          Choisir des fichiers
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            onChange={choisir}
            disabled={enCours}
            className="sr-only"
          />
        </label>
        {/* Sur téléphone : ouvre directement l'appareil photo, pour un papier ou un résultat de labo */}
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 ${enCours ? "pointer-events-none opacity-50" : ""}`}
        >
          <Camera className="h-4 w-4" aria-hidden />
          Prendre une photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={choisir}
            disabled={enCours}
            className="sr-only"
          />
        </label>
        <span className="text-xs text-slate-500">ou glissez les PDF ici · 4 Mo maximum par fichier</span>
      </div>

      {envois.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" aria-live="polite">
          {envois.map((e, i) => (
            <li key={i} className="flex items-center gap-2">
              {e.etat === "en cours" ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" aria-hidden />
              ) : e.etat === "fait" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" aria-hidden />
              )}
              <span className="text-slate-700">{e.nom}</span>
              {e.etat === "fait" && <span className="text-green-700">rangé dans Drive</span>}
              {e.message && <span className="text-red-700">{e.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function Bouton({
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

export function ConclusionExamen({
  langue,
  patientId,
  id,
  conclusion,
}: {
  langue: string;
  patientId: number;
  id: number;
  conclusion: string;
}) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-900">
        {conclusion ? "Modifier la conclusion" : "Ajouter une conclusion"}
      </summary>
      <form action={changerConclusion.bind(null, langue, patientId, id)} className="mt-2 flex flex-col gap-2">
        <textarea name="conclusion" rows={3} maxLength={5000} defaultValue={conclusion} className={champ} />
        <Bouton className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800">
          <Save className="h-3 w-3" aria-hidden />
          Enregistrer
        </Bouton>
      </form>
    </details>
  );
}

export function BoutonSupprimerExamen({
  langue,
  patientId,
  id,
  libelle,
}: {
  langue: string;
  patientId: number;
  id: number;
  libelle: string;
}) {
  return (
    <form action={retirerExamen.bind(null, langue, patientId, id)}>
      <Bouton
        confirmation={`Supprimer l'examen « ${libelle} » ? Le fichier part dans la corbeille de Google Drive.`}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
      >
        <Trash2 className="h-3 w-3" aria-hidden />
        Supprimer
      </Bouton>
    </form>
  );
}

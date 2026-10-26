"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { FileUp, RotateCcw, Trash2, Archive } from "lucide-react";
import { typesSource } from "../../../dossier/sources";
import { basculerStatut, commencerImport, envoyerPages, retirerSource, terminerImport } from "./actions";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// Lots envoyés au serveur : au plus 25 pages ou environ 300 000 caractères
const PAGES_PAR_LOT = 25;
const CARACTERES_PAR_LOT = 300_000;

type Page = { page: number | null; texte: string };

// Texte d'un PDF, page par page, lu dans le navigateur (le fichier n'est pas envoyé)
async function lirePdf(fichier: File): Promise<Page[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await fichier.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((texte, i) => ({ page: i + 1, texte }));
}

export function ImportSource({ langue }: { langue: string }) {
  const [mode, setMode] = useState<"pdf" | "texte">("pdf");
  const [etat, setEtat] = useState<{ erreur?: string; progres?: string; fait?: string }>({});
  const [occupe, setOccupe] = useState(false);

  async function importer(formData: FormData) {
    setOccupe(true);
    setEtat({});
    try {
      let pages: Page[];
      if (mode === "pdf") {
        const fichier = formData.get("fichier");
        if (!(fichier instanceof File) || !fichier.size) throw new Error("Choisissez le fichier PDF.");
        setEtat({ progres: "Lecture du PDF…" });
        pages = await lirePdf(fichier).catch(() => {
          throw new Error("Ce fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un PDF.");
        });
      } else {
        pages = [{ page: null, texte: String(formData.get("texte") ?? "") }];
      }
      const total = pages.reduce((n, p) => n + p.texte.trim().length, 0);
      if (total < 200) {
        throw new Error(
          mode === "pdf"
            ? "Ce PDF ne contient presque pas de texte (document scanné ?). Il faut un PDF dont le texte se sélectionne."
            : "Collez au moins quelques phrases.",
        );
      }

      const titre = String(formData.get("titre") ?? "");
      const debut = await commencerImport(langue, {
        titre,
        organisme: String(formData.get("organisme") ?? ""),
        annee: String(formData.get("annee") ?? ""),
        type: String(formData.get("type") ?? ""),
        langue: String(formData.get("langueSource") ?? ""),
        url: String(formData.get("url") ?? ""),
      });
      if ("erreur" in debut) throw new Error(debut.erreur);

      let passages = 0;
      for (let i = 0; i < pages.length; ) {
        const lot: Page[] = [];
        let taille = 0;
        while (
          i < pages.length &&
          lot.length < PAGES_PAR_LOT &&
          (taille === 0 || taille + pages[i].texte.length < CARACTERES_PAR_LOT)
        ) {
          taille += pages[i].texte.length;
          lot.push(pages[i++]);
        }
        setEtat({ progres: `Indexation : page ${i} sur ${pages.length}…` });
        passages += await envoyerPages(langue, debut.id, lot);
      }
      const ok = await terminerImport(langue, debut.id, pages.length, titre);
      if (!ok) throw new Error("Aucun passage n'a pu être indexé.");
      setEtat({ fait: `« ${titre} » ajouté : ${pages.length} page(s), ${passages} passages indexés.` });
      (document.getElementById("import-source") as HTMLFormElement | null)?.reset();
    } catch (erreur) {
      setEtat({
        erreur:
          erreur instanceof Error && !erreur.message.startsWith("An ")
            ? erreur.message
            : "L'import a échoué. Réessayez dans un instant.",
      });
    } finally {
      setOccupe(false);
    }
  }

  return (
    <form
      id="import-source"
      onSubmit={(e) => {
        e.preventDefault();
        importer(new FormData(e.currentTarget));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <fieldset className="flex flex-wrap gap-4 text-sm text-slate-700 sm:col-span-2">
        <legend className="sr-only">Contenu</legend>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === "pdf"} onChange={() => setMode("pdf")} />
          Fichier PDF (recommandation, RCP, article)
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === "texte"} onChange={() => setMode("texte")} />
          Texte collé (notice, protocole)
        </label>
      </fieldset>
      {mode === "pdf" ? (
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Fichier PDF
          <input name="fichier" type="file" accept="application/pdf" required className={champ} />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Le PDF est lu sur cet ordinateur : seul son texte est envoyé et indexé, le fichier n&apos;est pas conservé.
          </span>
        </label>
      ) : (
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Texte
          <textarea name="texte" required rows={8} maxLength={60000} className={champ} />
        </label>
      )}
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Titre
        <input
          name="titre"
          required
          maxLength={200}
          placeholder="Insuffisance cardiaque aiguë et chronique"
          className={champ}
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Organisme ou auteur
        <input name="organisme" maxLength={100} defaultValue="ESC" className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Année de l&apos;édition
        <input name="annee" inputMode="numeric" maxLength={4} placeholder="2023" className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Type
        <select name="type" defaultValue="recommandation" className={champ}>
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
        Langue du texte
        <select name="langueSource" defaultValue="en" className={champ}>
          <option value="en">Anglais</option>
          <option value="fr">Français</option>
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Lien vers la version officielle (facultatif)
        <input
          name="url"
          type="url"
          maxLength={500}
          placeholder="https://academic.oup.com/eurheartj/…"
          className={champ}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          L&apos;assistant ouvre ce lien à la page citée. Pour un PDF de l&apos;ESC, collez le lien du PDF lui-même.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={occupe}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <FileUp className="h-4 w-4" aria-hidden />
          Ajouter à la bibliothèque
        </button>
        {etat.progres && (
          <span role="status" className="text-sm text-slate-600">
            {etat.progres}
          </span>
        )}
      </div>
      {etat.erreur && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
          {etat.erreur}
        </p>
      )}
      {etat.fait && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 sm:col-span-2">
          {etat.fait}
        </p>
      )}
    </form>
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

export function BoutonsSource({
  langue,
  id,
  statut,
  titre,
}: {
  langue: string;
  id: number;
  statut: "en_vigueur" | "remplacee";
  titre: string;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <form action={basculerStatut.bind(null, langue, id, statut === "en_vigueur" ? "remplacee" : "en_vigueur")}>
        <Envoyer className={`${petit} text-slate-700`}>
          {statut === "en_vigueur" ? (
            <>
              <Archive className="h-3 w-3" aria-hidden />
              Marquer remplacée
            </>
          ) : (
            <>
              <RotateCcw className="h-3 w-3" aria-hidden />
              Remettre en vigueur
            </>
          )}
        </Envoyer>
      </form>
      <form
        action={retirerSource.bind(null, langue, id)}
        onSubmit={(e) => {
          if (!confirm(`Retirer « ${titre} » de la bibliothèque ?`)) e.preventDefault();
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

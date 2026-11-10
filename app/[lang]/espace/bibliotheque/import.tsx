"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileUp, RotateCcw, Trash2, Archive } from "lucide-react";
import { typesSource } from "../../../dossier/sources";
import { doiDePdf } from "../../../dossier/resolution";
import { basculerStatut, commencerImport, envoyerPages, identifierDocument, retirerSource, terminerImport } from "./actions";

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

// Envoie les pages au serveur par lots (au plus 25 pages ou environ 300 000 caractères) ; renvoie le nombre de passages
async function envoyerEnLots(langue: string, id: number, pages: Page[], surProgres: (fait: number, total: number) => void) {
  let passages = 0;
  for (let i = 0; i < pages.length; ) {
    const lot: Page[] = [];
    let taille = 0;
    while (i < pages.length && lot.length < PAGES_PAR_LOT && (taille === 0 || taille + pages[i].texte.length < CARACTERES_PAR_LOT)) {
      taille += pages[i].texte.length;
      lot.push(pages[i++]);
    }
    surProgres(i, pages.length);
    passages += await envoyerPages(langue, id, lot);
  }
  return passages;
}

// Valeurs pré-remplies quand la source vient d'une publication d'un site suivi
export type Preremplissage = {
  publication: number;
  titre: string;
  organisme: string;
  annee: number | null;
  type: string;
  langue: "fr" | "en";
  url: string;
};

export function ImportSource({ langue, initial }: { langue: string; initial?: Preremplissage }) {
  const [mode, setMode] = useState<"pdf" | "texte">("pdf");
  const [etat, setEtat] = useState<{ erreur?: string; progres?: string; fait?: string }>({});
  const [occupe, setOccupe] = useState(false);
  // Document déposé : DOI lu sur sa première page, publication suivie reconnue, anciennes éditions à remplacer
  const [doi, setDoi] = useState("");
  const [publication, setPublication] = useState<number | null>(initial?.publication ?? null);
  const [identification, setIdentification] = useState("");
  const [remplacables, setRemplacables] = useState<{ id: number; titre: string; annee: number | null }[]>([]);
  const lu = useRef<{ fichier: File; pages: Page[] } | null>(null);

  async function pagesDe(fichier: File) {
    if (lu.current?.fichier === fichier) return lu.current.pages;
    const pages = await lirePdf(fichier);
    lu.current = { fichier, pages };
    return pages;
  }

  // Dès le choix du fichier : DOI → publication suivie ou métadonnées publiques → champs remplis
  async function reconnaitre(fichier: File | undefined) {
    setDoi("");
    setIdentification("");
    setRemplacables([]);
    if (!fichier) return;
    setIdentification("Lecture du document…");
    try {
      const pages = await pagesDe(fichier);
      const trouve = doiDePdf(`${pages[0]?.texte ?? ""}\n${pages[1]?.texte ?? ""}`);
      if (!trouve) return setIdentification("Aucun DOI lu sur la première page : remplissez les champs ci-dessous.");
      const r = await identifierDocument(langue, trouve);
      if (!r.trouve) return setIdentification("");
      setDoi(r.doi);
      setPublication(r.publication ?? initial?.publication ?? null);
      const formulaire = document.getElementById("import-source") as HTMLFormElement | null;
      const mettre = (nom: string, valeur: string) => {
        const champ = formulaire?.elements.namedItem(nom);
        if (valeur && (champ instanceof HTMLInputElement || champ instanceof HTMLSelectElement)) champ.value = valeur;
      };
      mettre("titre", r.titre);
      mettre("organisme", r.organisme);
      mettre("annee", r.annee ? String(r.annee) : "");
      mettre("type", r.type);
      mettre("langueSource", r.langue);
      mettre("url", r.url);
      setIdentification(
        r.existante
          ? `Ce document est déjà dans la bibliothèque (« ${r.existante.titre} »). Ne l'ajoutez pas une seconde fois.`
          : r.titre
            ? `Document reconnu (DOI ${r.doi})${r.publication ? ", publication suivie retrouvée" : ""} : vérifiez les champs remplis, puis ajoutez-le.`
            : `DOI ${r.doi} lu, mais ses informations n'ont pas pu être retrouvées : remplissez les champs.`,
      );
    } catch {
      setIdentification("");
    }
  }

  async function importer(formData: FormData) {
    setOccupe(true);
    setEtat({});
    try {
      let pages: Page[];
      if (mode === "pdf") {
        const fichier = formData.get("fichier");
        if (!(fichier instanceof File) || !fichier.size) throw new Error("Choisissez le fichier PDF.");
        setEtat({ progres: "Lecture du PDF…" });
        pages = await pagesDe(fichier).catch(() => {
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
        publication,
        doi,
      });
      if ("erreur" in debut) throw new Error(debut.erreur);

      const passages = await envoyerEnLots(langue, debut.id, pages, (fait, total) =>
        setEtat({ progres: `Indexation : page ${fait} sur ${total}…` }),
      );
      const { ok, remplacables: anciennes } = await terminerImport(langue, debut.id, pages.length, titre);
      if (!ok) throw new Error("Aucun passage n'a pu être indexé.");
      setRemplacables(anciennes);
      setDoi("");
      setIdentification("");
      lu.current = null;
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
          <input
            name="fichier"
            type="file"
            accept="application/pdf"
            required
            className={champ}
            onChange={(e) => reconnaitre(e.target.files?.[0])}
          />
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
          defaultValue={initial?.titre}
          className={champ}
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Organisme ou auteur
        <input name="organisme" maxLength={100} defaultValue={initial ? initial.organisme : "ESC"} className={champ} />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Année de l&apos;édition
        <input
          name="annee"
          inputMode="numeric"
          maxLength={4}
          placeholder="2023"
          defaultValue={initial?.annee ?? undefined}
          className={champ}
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Type
        <select name="type" defaultValue={initial?.type ?? "recommandation"} className={champ}>
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
        <select name="langueSource" defaultValue={initial?.langue ?? "en"} className={champ}>
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
          defaultValue={initial?.url}
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
      {identification && (
        <p role="status" className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900 sm:col-span-2">
          {identification}
        </p>
      )}
      {remplacables.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
          <p className="font-medium">Une édition plus ancienne du même sujet est encore en vigueur :</p>
          <ul className="mt-2 space-y-1">
            {remplacables.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {a.titre}
                  {a.annee ? ` (${a.annee})` : ""}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await basculerStatut(langue, a.id, "remplacee");
                    setRemplacables((l) => l.filter((x) => x.id !== a.id));
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-amber-900 underline hover:bg-amber-100"
                >
                  Marquer remplacée
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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

type Resultat = { nom: string; etat: "ajoute" | "doublon" | "manuel" | "erreur"; detail: string };

// Plusieurs PDF à la fois : chacun est reconnu par son DOI (publication suivie ou métadonnées publiques) et ajouté sans
// formulaire. Ce qui n'est pas reconnu (pas de DOI, document scanné, informations introuvables) est laissé à l'ajout
// à la main, jamais ajouté au hasard.
export function ImportParLot({ langue }: { langue: string }) {
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [progres, setProgres] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [remplacables, setRemplacables] = useState<{ id: number; titre: string; annee: number | null }[]>([]);

  async function lancer(fichiers: File[]) {
    setOccupe(true);
    setResultats([]);
    setRemplacables([]);
    const note = (r: Resultat) => setResultats((liste) => [...liste, r]);
    for (const [n, fichier] of fichiers.entries()) {
      const etiquette = `${n + 1}/${fichiers.length} — ${fichier.name}`;
      try {
        setProgres(`${etiquette} : lecture…`);
        const pages = await lirePdf(fichier).catch(() => null);
        if (!pages) {
          note({ nom: fichier.name, etat: "erreur", detail: "fichier illisible (est-ce un PDF ?)" });
          continue;
        }
        if (pages.reduce((total, p) => total + p.texte.trim().length, 0) < 200) {
          note({ nom: fichier.name, etat: "manuel", detail: "presque pas de texte (document scanné ?) : à ajouter à la main" });
          continue;
        }
        const doi = doiDePdf(`${pages[0]?.texte ?? ""}\n${pages[1]?.texte ?? ""}`);
        if (!doi) {
          note({ nom: fichier.name, etat: "manuel", detail: "aucun DOI lu sur la première page : à ajouter à la main" });
          continue;
        }
        const r = await identifierDocument(langue, doi);
        if (!r.trouve || !r.titre) {
          note({ nom: fichier.name, etat: "manuel", detail: `DOI ${doi} lu, mais titre introuvable : à ajouter à la main` });
          continue;
        }
        if (r.existante) {
          note({ nom: fichier.name, etat: "doublon", detail: `déjà dans la bibliothèque (« ${r.existante.titre} »)` });
          continue;
        }
        const debut = await commencerImport(langue, {
          titre: r.titre,
          organisme: r.organisme,
          annee: r.annee ? String(r.annee) : "",
          type: r.type,
          langue: r.langue,
          url: r.url,
          publication: r.publication,
          doi: r.doi,
        });
        if ("erreur" in debut) {
          note({ nom: fichier.name, etat: "erreur", detail: debut.erreur });
          continue;
        }
        const passages = await envoyerEnLots(langue, debut.id, pages, (fait, total) => setProgres(`${etiquette} : indexation, page ${fait} sur ${total}…`));
        const fin = await terminerImport(langue, debut.id, pages.length, r.titre);
        if (!fin.ok) {
          note({ nom: fichier.name, etat: "erreur", detail: "aucun passage n'a pu être indexé" });
          continue;
        }
        setRemplacables((liste) => [...liste, ...fin.remplacables.filter((a) => !liste.some((x) => x.id === a.id))]);
        note({ nom: fichier.name, etat: "ajoute", detail: `« ${r.titre} » : ${pages.length} page(s), ${passages} passages` });
      } catch {
        note({ nom: fichier.name, etat: "erreur", detail: "l'import a échoué, réessayez ce fichier seul" });
      }
    }
    setProgres("");
    setOccupe(false);
  }

  const couleur: Record<Resultat["etat"], string> = {
    ajoute: "bg-emerald-50 text-emerald-900",
    doublon: "bg-slate-100 text-slate-700",
    manuel: "bg-amber-50 text-amber-900",
    erreur: "bg-red-50 text-red-800",
  };
  const libelle: Record<Resultat["etat"], string> = { ajoute: "Ajouté", doublon: "Déjà là", manuel: "À faire à la main", erreur: "Échec" };

  return (
    <div className="space-y-4 text-sm">
      <label className="block font-medium text-slate-700">
        Plusieurs fichiers PDF
        <input
          type="file"
          accept="application/pdf"
          multiple
          disabled={occupe}
          className={champ}
          onChange={(e) => {
            const fichiers = [...(e.target.files ?? [])];
            if (fichiers.length) void lancer(fichiers);
            e.target.value = "";
          }}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Le DOI de chaque document est lu sur sa première page : titre, année, organisme et lien se remplissent seuls. Les
          fichiers sont lus sur cet ordinateur ; seul leur texte est envoyé.
        </span>
      </label>
      {progres && <p role="status" className="text-slate-600">{progres}</p>}
      {resultats.length > 0 && (
        <ul className="space-y-1">
          {resultats.map((r, i) => (
            <li key={i} className={`rounded-lg p-2 ${couleur[r.etat]}`}>
              <span className="font-medium">{libelle[r.etat]}</span> — {r.nom} : {r.detail}
            </li>
          ))}
        </ul>
      )}
      {remplacables.length > 0 && (
        <div role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">
          <p className="font-medium">Éditions plus anciennes du même sujet, encore en vigueur :</p>
          <ul className="mt-2 space-y-1">
            {remplacables.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {a.titre}
                  {a.annee ? ` (${a.annee})` : ""}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await basculerStatut(langue, a.id, "remplacee");
                    setRemplacables((l) => l.filter((x) => x.id !== a.id));
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium underline hover:bg-amber-100"
                >
                  Marquer remplacée
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

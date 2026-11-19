"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, FilePen, ListChecks, LoaderCircle, Mic, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { libellesAction, type ActionNote } from "../../../dossier/note-vocale";
import { suivisCourants } from "../../../dossier/suivis";
import { arreterDictee, dicterDans } from "../../../voix/dictee-champ";
import { chercherDossiers } from "../actions";
import { appliquerNote, patientDeLaNote, type BilanNote } from "./actions";
import { useDictee } from "./voix";

type PatientNote = { id: number; libelle: string };
type Brouillon = ActionNote & { cle: number; garde: boolean };
type Etape =
  | { nom: "saisie" }
  | { nom: "relecture"; actions: Brouillon[]; parClaude: boolean; avertissement?: string }
  | { nom: "bilan"; bilan: BilanNote; ordonnance: string };

const libellePatient = (p: { nom: string; prenom: string }) => [p.nom.toUpperCase(), p.prenom].filter(Boolean).join(" ");

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// Note vocale : on dicte librement, le site range la dictée en actions (note, suivi, traitement, ordonnance),
// le médecin les relit et les valide. Rien n'est enregistré avant « Enregistrer ».
export function NoteVocale({
  langue,
  ouverte,
  ouvrir,
  masquee,
}: {
  langue: string;
  ouverte: boolean;
  ouvrir: (o: boolean) => void;
  masquee: boolean;
}) {
  const dictee = useDictee();
  const chemin = usePathname();
  const zone = useRef<HTMLTextAreaElement>(null);
  const [patient, setPatient] = useState<PatientNote | null>(null);
  const [recherche, setRecherche] = useState("");
  const [trouves, setTrouves] = useState<PatientNote[]>([]);
  const [texte, setTexte] = useState("");
  const [etape, setEtape] = useState<Etape>({ nom: "saisie" });
  const [erreur, setErreur] = useState("");
  const [rangement, setRangement] = useState(false);
  const [enregistrement, enregistrer] = useTransition();

  // À l'ouverture : le patient de la page affichée, et la dictée démarre dans la note
  const dossierOuvert = Number(chemin.match(/\/espace\/patients\/(\d+)/)?.[1] ?? 0);
  useEffect(() => {
    if (!ouverte) return;
    let actif = true;
    if (dossierOuvert) {
      patientDeLaNote(langue, dossierOuvert)
        .then((p) => actif && p && setPatient(p))
        .catch(() => undefined);
    }
    if (zone.current) {
      zone.current.focus();
      dicterDans(zone.current);
    }
    return () => {
      actif = false;
    };
  }, [ouverte, dossierOuvert, langue]);

  useEffect(() => {
    if (recherche.trim().length < 2) return;
    const minuteur = setTimeout(async () => {
      const dossiers = await chercherDossiers(langue, recherche).catch(() => []);
      setTrouves(dossiers.map((d) => ({ id: d.id, libelle: libellePatient(d) })));
    }, 250);
    return () => clearTimeout(minuteur);
  }, [recherche, langue]);

  function fermer() {
    arreterDictee();
    ouvrir(false);
  }

  function recommencer() {
    setTexte("");
    setErreur("");
    setEtape({ nom: "saisie" });
  }

  async function ranger(superieur = false) {
    arreterDictee();
    setRangement(true);
    setErreur("");
    try {
      const reponse = await fetch("/api/voix/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte, patient: patient?.id ?? null, superieur }),
      });
      const corps = (await reponse.json().catch(() => ({}))) as {
        actions?: ActionNote[];
        parClaude?: boolean;
        avertissement?: string;
        erreur?: string;
      };
      if (!reponse.ok || !corps.actions) throw new Error(corps.erreur ?? "Erreur inattendue.");
      setEtape({
        nom: "relecture",
        actions: corps.actions.map((a, cle) => ({ ...a, cle, garde: true })),
        parClaude: corps.parClaude === true,
        avertissement: corps.avertissement,
      });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setRangement(false);
    }
  }

  const modifier = (cle: number, changement: Partial<Brouillon>) =>
    setEtape((e) =>
      e.nom === "relecture"
        ? { ...e, actions: e.actions.map((a) => (a.cle === cle ? ({ ...a, ...changement } as Brouillon) : a)) }
        : e,
    );

  function valider() {
    if (etape.nom !== "relecture" || !patient) return;
    const gardees = etape.actions.filter((a) => a.garde);
    enregistrer(async () => {
      try {
        const bilan = await appliquerNote(
          langue,
          patient.id,
          gardees.filter((a) => a.type !== "ordonnance"),
        );
        const ordonnance = gardees.flatMap((a) => (a.type === "ordonnance" ? [a.texte] : [])).join("\n");
        setEtape({ nom: "bilan", bilan, ordonnance });
      } catch {
        setErreur("Les actions n'ont pas pu être enregistrées. Réessayez.");
      }
    });
  }

  if (!ouverte) {
    if (masquee) return null;
    return (
      <button
        type="button"
        onClick={() => ouvrir(true)}
        title="Note vocale (Ctrl+M)"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-red-700 print:hidden"
      >
        <Mic className="h-4 w-4" aria-hidden />
        Note vocale
      </button>
    );
  }

  const enDictee = dictee.cible?.id === "note-vocale-texte";
  const gardees = etape.nom === "relecture" ? etape.actions.filter((a) => a.garde).length : 0;

  return (
    <section
      aria-label="Note vocale"
      className="fixed bottom-4 right-4 z-50 flex max-h-[calc(100dvh-6rem)] w-[min(30rem,calc(100%-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-2xl print:hidden"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Mic className="h-4 w-4 text-red-600" aria-hidden />
          Note vocale
        </h2>
        <button type="button" onClick={fermer} aria-label="Fermer la note vocale" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="space-y-4 overflow-y-auto p-4">
        {patient ? (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
            <span>
              Dossier : <strong>{patient.libelle}</strong> · n° {patient.id}
            </span>
            {etape.nom !== "bilan" && (
              <button type="button" onClick={() => setPatient(null)} className="text-xs text-slate-500 underline">
                Changer
              </button>
            )}
          </p>
        ) : (
          <div data-dictee="non">
            <label className="font-medium text-slate-700">
              Pour quel patient ?
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom, prénom, téléphone ou n° de dossier"
                className={champ}
              />
            </label>
            {recherche.trim().length >= 2 && trouves.length > 0 && (
              <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {trouves.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPatient(p);
                        setRecherche("");
                      }}
                      className="block w-full px-3 py-2 text-left hover:bg-red-50"
                    >
                      {p.libelle} <span className="text-slate-400">· n° {p.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {etape.nom === "saisie" && (
          <>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="note-vocale-texte" className="font-medium text-slate-700">
                  Dictez ou écrivez
                </label>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => zone.current && dicterDans(zone.current)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white ${
                    enDictee ? "bg-slate-900" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {enDictee ? <Square className="h-3 w-3" aria-hidden /> : <Mic className="h-3 w-3" aria-hidden />}
                  {enDictee ? "Arrêter" : "Dicter"}
                </button>
              </div>
              <textarea
                id="note-vocale-texte"
                ref={zone}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                rows={6}
                maxLength={6000}
                placeholder="Ex. : contrôle dans 6 mois avec échocardiographie, arrêter le Cardix, débuter bisoprolol 2,5 mg un comprimé le matin…"
                className={champ}
              />
              <p className="mt-1 text-xs text-slate-500">
                Le nom du patient est masqué avant l&apos;envoi à Claude. Vous relisez chaque action avant qu&apos;elle soit
                enregistrée.
              </p>
            </div>
            <button
              type="button"
              onClick={() => ranger()}
              disabled={rangement || texte.trim().length < 3}
              className="inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-2 font-medium text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {rangement ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <ListChecks className="h-4 w-4" aria-hidden />}
              Ranger en actions
            </button>
          </>
        )}

        {etape.nom === "relecture" && (
          <>
            {etape.avertissement && (
              <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">
                {etape.avertissement}
              </p>
            )}
            <ul className="space-y-3">
              {etape.actions.map((a) => (
                <li key={a.cle} className={`rounded-xl border p-3 ${a.garde ? "border-slate-200" : "border-slate-100 opacity-50"}`}>
                  <label className="flex items-center gap-2 font-medium text-slate-900">
                    <input
                      type="checkbox"
                      checked={a.garde}
                      onChange={(e) => modifier(a.cle, { garde: e.target.checked })}
                      className="accent-red-600"
                    />
                    {libellesAction[a.type]}
                  </label>
                  {a.type === "note" && (
                    <textarea
                      aria-label="Texte de la note"
                      value={a.texte}
                      onChange={(e) => modifier(a.cle, { texte: e.target.value })}
                      rows={2}
                      maxLength={2000}
                      className={champ}
                    />
                  )}
                  {a.type === "suivi" && (
                    <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                      <input
                        aria-label="Suivi à prévoir"
                        value={a.quoi}
                        list="note-suivis"
                        onChange={(e) => modifier(a.cle, { quoi: e.target.value })}
                        maxLength={200}
                        className={champ}
                      />
                      <input
                        aria-label="Échéance"
                        type="date"
                        value={a.echeance}
                        onChange={(e) => modifier(a.cle, { echeance: e.target.value })}
                        className={`${champ} ${a.echeance ? "" : "border-amber-400"}`}
                      />
                      {!a.echeance && <p className="text-xs text-amber-800 sm:col-span-2">Échéance non dictée : indiquez-la.</p>}
                    </div>
                  )}
                  {a.type === "traitement" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        aria-label="Médicament"
                        value={a.medicament}
                        onChange={(e) => modifier(a.cle, { medicament: e.target.value })}
                        maxLength={150}
                        className={champ}
                      />
                      <input
                        aria-label="Posologie"
                        value={a.posologie}
                        placeholder="Posologie"
                        onChange={(e) => modifier(a.cle, { posologie: e.target.value })}
                        maxLength={300}
                        className={champ}
                      />
                    </div>
                  )}
                  {a.type === "arret" && (
                    <input
                      aria-label="Médicament à arrêter"
                      value={a.medicament}
                      onChange={(e) => modifier(a.cle, { medicament: e.target.value })}
                      maxLength={150}
                      className={champ}
                    />
                  )}
                  {a.type === "ordonnance" && (
                    <>
                      <textarea
                        aria-label="Lignes de l'ordonnance"
                        value={a.texte}
                        onChange={(e) => modifier(a.cle, { texte: e.target.value })}
                        rows={3}
                        maxLength={2000}
                        className={champ}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Une ligne par médicament. Le formulaire d&apos;ordonnance s&apos;ouvrira prérempli : vous le complétez et
                        l&apos;enregistrez.
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <datalist id="note-suivis">
              {suivisCourants.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {!patient && <p className="text-amber-800">Choisissez le patient pour enregistrer.</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={valider}
                disabled={enregistrement || !patient || gardees === 0}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {enregistrement ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                Enregistrer {gardees} action{gardees > 1 ? "s" : ""}
              </button>
              {etape.parClaude && (
                <button
                  type="button"
                  onClick={() => ranger(true)}
                  disabled={rangement}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-300 px-3 py-2 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                >
                  {rangement ? <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden /> : <Sparkles className="h-3 w-3" aria-hidden />}
                  Refaire avec le modèle supérieur
                </button>
              )}
              <button
                type="button"
                onClick={() => setEtape({ nom: "saisie" })}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Revenir à la dictée
              </button>
            </div>
          </>
        )}

        {etape.nom === "bilan" && (
          <>
            {etape.bilan.faits.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-emerald-50 p-3 text-emerald-900">
                {etape.bilan.faits.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            {etape.bilan.echecs.length > 0 && (
              <ul role="alert" className="list-disc space-y-1 rounded-lg bg-amber-50 p-3 ps-7 text-amber-900">
                {etape.bilan.echecs.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {etape.ordonnance && patient && (
                <Link
                  href={`/${langue}/espace/patients/${patient.id}/ordonnance?dictee=${encodeURIComponent(etape.ordonnance)}`}
                  onClick={fermer}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                >
                  <FilePen className="h-4 w-4" aria-hidden />
                  Ouvrir l&apos;ordonnance préremplie
                </Link>
              )}
              <button
                type="button"
                onClick={recommencer}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                <Mic className="h-4 w-4" aria-hidden />
                Nouvelle note
              </button>
            </div>
          </>
        )}

        {erreur && (
          <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">
            {erreur}
          </p>
        )}
      </div>
    </section>
  );
}

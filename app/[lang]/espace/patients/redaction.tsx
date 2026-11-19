"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, FileSearch, LoaderCircle, Mic, Sparkles, Square } from "lucide-react";
import type { ReferenceJointe } from "../../../dossier/redaction";
import { lienPage } from "../../../dossier/sources";
import { Moteur, type Reconnaissance } from "./dictee";
import { enregistrerCompteRendu } from "./actions-documents";
import { ChoixConsultation } from "./choix-consultation";
import type { OptionConsultation } from "../../../dossier/choix-consultation";

type Resultat = { compteRendu: string; verifications: string[]; references: ReferenceJointe[] };

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

// Dictée (ou texte saisi) → compte rendu rédigé par Claude avec le prompt du cabinet → relecture → enregistrement
export function RedactionCompteRendu({
  langue,
  patientId,
  types,
  claude,
  aujourdhui,
  consultations,
  consultationDefaut,
}: {
  langue: string;
  patientId: number;
  types: string[];
  claude: boolean;
  aujourdhui: string;
  consultations: OptionConsultation[];
  consultationDefaut?: number;
}) {
  const [consultation, setConsultation] = useState(String(consultationDefaut ?? ""));
  const [type, setType] = useState(types[0] ?? "");
  const [date, setDate] = useState(aujourdhui);
  const [dictee, setDictee] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [texte, setTexte] = useState("");
  const [copie, setCopie] = useState(false);
  const [sauvegarde, sauvegarder] = useTransition();
  const reconnaissance = useRef<Reconnaissance | null>(null);
  const actif = useRef(false);

  function dicter() {
    const Classe = Moteur();
    if (!Classe) {
      setErreur("Ce navigateur ne sait pas dicter : utilisez Chrome, Edge ou Safari, ou saisissez le texte.");
      return;
    }
    setErreur("");
    const r = new Classe();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let ajout = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) ajout += ` ${e.results[i][0].transcript}`;
      if (ajout) setDictee((d) => `${d} ${ajout}`.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        actif.current = false;
        setEnregistrement(false);
        setErreur("Le micro n'est pas autorisé : autorisez-le dans le navigateur.");
      }
    };
    // Le navigateur s'arrête après un silence : on relance tant que le médecin n'a pas arrêté
    r.onend = () => {
      if (actif.current) r.start();
      else setEnregistrement(false);
    };
    reconnaissance.current = r;
    actif.current = true;
    setEnregistrement(true);
    r.start();
  }

  function arreter() {
    actif.current = false;
    reconnaissance.current?.stop();
  }

  async function rediger() {
    arreter();
    setEnCours(true);
    setErreur("");
    try {
      const reponse = await fetch("/api/dictee/redaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, texte: dictee, patient: patientId }),
      });
      const corps = (await reponse.json().catch(() => ({}))) as Resultat & { erreur?: string };
      if (!reponse.ok) throw new Error(corps.erreur ?? "Erreur inattendue.");
      setResultat(corps);
      setTexte(corps.compteRendu);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setEnCours(false);
    }
  }

  // Références dont le repère [R1] figure encore dans le texte : elles sont reprises à la fin du compte rendu
  const citees = (resultat?.references ?? []).filter((r) => new RegExp(`\\[[^\\]]*\\b${r.repere}\\b[^\\]]*\\]`).test(texte));
  const ligne = (r: ReferenceJointe) =>
    `[${r.repere}] ${r.titre}${r.page ? `, p. ${r.page}` : ""}${r.url ? ` — ${lienPage(r.url, r.page)}` : ""}`;

  function enregistrer() {
    sauvegarder(async () => {
      const final = citees.length ? `${texte.trim()}\n\nRÉFÉRENCES\n${citees.map(ligne).join("\n")}` : texte;
      const message = await enregistrerCompteRendu(langue, patientId, type, date, final, consultation);
      if (message) setErreur(message);
    });
  }

  if (!claude) {
    return (
      <p role="note" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Claude n&apos;est pas configuré (clé ANTHROPIC_API_KEY, voir DOSSIER.md).
      </p>
    );
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="font-medium text-slate-700">
          Type d&apos;examen
          <select value={type} onChange={(e) => setType(e.target.value)} className={champ}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="font-medium text-slate-700">
          Date de l&apos;examen
          <input type="date" value={date} max={aujourdhui} onChange={(e) => setDate(e.target.value)} className={champ} />
        </label>
      </div>
      <ChoixConsultation consultations={consultations} valeur={consultation} surChangement={setConsultation} className="block" />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="dictee-examen" className="font-medium text-slate-700">
            Dictée ou résultats de l&apos;examen
          </label>
          {enregistrement ? (
            <button type="button" onClick={arreter} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
              <Square className="h-3 w-3" aria-hidden />
              Arrêter la dictée
            </button>
          ) : (
            <button type="button" onClick={dicter} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
              <Mic className="h-3 w-3" aria-hidden />
              Dicter
            </button>
          )}
        </div>
        <textarea
          id="dictee-examen"
          value={dictee}
          onChange={(e) => setDictee(e.target.value)}
          rows={8}
          maxLength={10000}
          placeholder="Ex. : écho veineuse, 72 ans, réseau perméable et compressible, œdème du membre inférieur droit remontant au genou…"
          className={champ}
        />
        <p className="mt-1 text-xs text-slate-500">
          Seul ce texte part chez Claude, avec un résumé du dossier sans nom ni coordonnées. Ce qui n&apos;est pas dicté reste
          « À COMPLÉTER ».
        </p>
      </div>

      <button
        type="button"
        onClick={rediger}
        disabled={enCours || dictee.trim().length < 10}
        className="inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-2 font-medium text-white hover:bg-violet-800 disabled:opacity-50"
      >
        {enCours ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
        Rédiger le compte rendu
      </button>

      {erreur && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">
          {erreur}
        </p>
      )}

      {resultat && (
        <div className="space-y-4 border-t border-slate-200 pt-5">
          {resultat.verifications.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="font-medium text-amber-900">À vérifier avant d&apos;enregistrer</p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-amber-900">
                {resultat.verifications.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="block font-medium text-slate-700">
            Compte rendu (modifiable)
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={22} className={`${champ} font-mono`} />
          </label>
          <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Références citées dans ce texte</p>
            {citees.length === 0 ? (
              <p className="mt-1 text-amber-800">
                Aucun repère de référence dans le texte{resultat.references.length === 0 ? " : aucun passage de la bibliothèque n'a été trouvé pour cet examen" : ""}.
                Les affirmations médicales ne sont alors appuyées sur aucune source : relisez-les avec attention.
              </p>
            ) : (
              <ul className="mt-1 space-y-2">
                {citees.map((r) => (
                  <li key={r.repere}>
                    <span className="font-medium text-slate-800">[{r.repere}]</span> {r.titre}
                    {r.page ? `, p. ${r.page}` : ""}
                    <span className="ms-3 inline-flex flex-wrap gap-3">
                      <a
                        href={`/${langue}/espace/bibliotheque/passage/${r.passageId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-red-700 underline"
                      >
                        <FileSearch className="h-3 w-3" aria-hidden />
                        Voir le passage
                      </a>
                      {r.url && (
                        <a
                          href={lienPage(r.url, r.page)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-red-700 underline"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          {r.page ? `Ouvrir le document, page ${r.page}` : "Ouvrir le document"}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Remplacez chaque « [À COMPLÉTER] » ou supprimez la ligne. C&apos;est une aide : vous relisez, corrigez et validez ; les références citées sont reprises à la fin du compte rendu enregistré.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enregistrer}
              disabled={sauvegarde || !texte.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden />
              Enregistrer dans les examens
            </button>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(texte).catch(() => undefined);
                setCopie(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copie ? "Copié" : "Copier le texte"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

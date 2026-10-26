"use client";

import { useEffect, useRef, useState } from "react";
import { BookPlus, Check, LoaderCircle, Mic, RotateCcw, Sparkles, Square } from "lucide-react";
import { corrigerLocalement, type Correction, type Rubrique } from "../../../dossier/correction-locale";
import { ajouterAuLexique } from "../lexique/actions";

const DUREE_MAX = 5 * 60; // secondes

const libelles: Record<Rubrique, string> = {
  motif: "Motif",
  examen: "Examen clinique",
  ecg: "ECG",
  autres: "Autres",
  conclusion: "Conclusion",
  conduite: "Conduite à tenir",
};

// Reconnaissance vocale du navigateur (Chrome, Edge, Safari) : gratuite, le texte arrive pendant que l'on parle
type Resultat = { isFinal: boolean; 0: { transcript: string } };
type Reconnaissance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Resultat> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type FenetreAvecDictee = {
  SpeechRecognition?: new () => Reconnaissance;
  webkitSpeechRecognition?: new () => Reconnaissance;
};
const Moteur = () =>
  typeof window === "undefined"
    ? undefined
    : ((window as unknown as FenetreAvecDictee).SpeechRecognition ??
      (window as unknown as FenetreAvecDictee).webkitSpeechRecognition);

type Etape =
  | { nom: "pret" }
  | { nom: "enregistrement"; secondes: number; texte: string; provisoire: string }
  | { nom: "relecture"; brut: string; correction: Correction; parClaude: boolean }
  | { nom: "erreur"; message: string };

// Dictée de toute la consultation : texte corrigé gratuitement, amélioré par Claude si on le demande, relu puis inséré
// dans le formulaire (rien n'est enregistré avant « Enregistrer la consultation »)
export function DicteeConsultation({
  langue,
  libellesValeurs,
  lexique,
  claude,
  inserer,
}: {
  langue: string;
  libellesValeurs: Record<string, string>;
  lexique: { entendu: string; correct: string }[];
  claude: boolean;
  inserer: (c: Correction) => void;
}) {
  const [etape, setEtape] = useState<Etape>({ nom: "pret" });
  const reconnaissance = useRef<Reconnaissance | null>(null);
  const actif = useRef(false);
  const texte = useRef("");
  const provisoire = useRef("");
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);
  const debut = useRef(0);
  const appris = useRef([...lexique]);

  useEffect(
    () => () => {
      actif.current = false;
      if (minuteur.current) clearInterval(minuteur.current);
      reconnaissance.current?.stop();
    },
    [],
  );

  const afficher = () =>
    setEtape({
      nom: "enregistrement",
      secondes: Math.floor((Date.now() - debut.current) / 1000),
      texte: texte.current,
      provisoire: provisoire.current,
    });

  function commencer() {
    const Classe = Moteur();
    if (!Classe) {
      setEtape({ nom: "erreur", message: "Ce navigateur ne sait pas dicter : utilisez Chrome, Edge ou Safari." });
      return;
    }
    texte.current = "";
    provisoire.current = "";
    debut.current = Date.now();
    actif.current = true;

    const r = new Classe();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let enCours = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const morceau = e.results[i][0].transcript;
        if (e.results[i].isFinal) texte.current = `${texte.current} ${morceau}`.trim();
        else enCours += morceau;
      }
      provisoire.current = enCours;
      afficher();
    };
    let bloquee = false;
    r.onerror = (e) => {
      const message =
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Le micro n'est pas autorisé : autorisez-le dans le navigateur."
          : e.error === "network"
            ? "La dictée du navigateur a besoin d'Internet. Vérifiez la connexion."
            : null;
      // « no-speech », « aborted » : la reconnaissance redémarre d'elle-même (onend)
      if (!message) return;
      bloquee = true;
      actif.current = false;
      setEtape({ nom: "erreur", message });
    };
    // Le navigateur s'arrête après un silence : on relance tant que le médecin n'a pas terminé
    r.onend = () => {
      if (actif.current && Date.now() - debut.current < DUREE_MAX * 1000) {
        r.start();
        return;
      }
      if (minuteur.current) clearInterval(minuteur.current);
      if (!bloquee) terminer();
    };
    reconnaissance.current = r;
    r.start();
    afficher();
    minuteur.current = setInterval(() => {
      if (Date.now() - debut.current >= DUREE_MAX * 1000) arreter();
      else afficher();
    }, 500);
  }

  function arreter() {
    actif.current = false;
    reconnaissance.current?.stop();
  }

  function terminer() {
    const brut = `${texte.current} ${provisoire.current}`.trim();
    reconnaissance.current = null;
    if (!brut) {
      setEtape({ nom: "erreur", message: "Aucune parole reconnue. Parlez plus près du micro et recommencez." });
      return;
    }
    setEtape({ nom: "relecture", brut, correction: corrigerLocalement(brut, appris.current), parClaude: false });
  }

  const bouton = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium";

  return (
    <section className="rounded-xl border border-red-100 bg-red-50/40 p-4" aria-live="polite">
      {etape.nom === "pret" && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={commencer} className={`${bouton} bg-red-600 text-white hover:bg-red-700`}>
            <Mic className="h-4 w-4" aria-hidden />
            Dicter la consultation
          </button>
          <span className="text-xs text-slate-600">
            Dites par exemple « motif : contrôle… à la ligne… conclusion : … ». 5 minutes au plus. Vous relirez avant
            l&apos;insertion.
          </span>
        </div>
      )}

      {etape.nom === "enregistrement" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={arreter} className={`${bouton} bg-slate-900 text-white hover:bg-slate-800`}>
              <Square className="h-4 w-4" aria-hidden />
              Terminer la dictée
            </button>
            <span className="inline-flex items-center gap-2 text-sm text-red-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden />
              Enregistrement {Math.floor(etape.secondes / 60)}:{String(etape.secondes % 60).padStart(2, "0")}
            </span>
          </div>
          <p className="min-h-12 rounded-lg bg-white p-3 text-sm text-slate-900">
            {etape.texte} <span className="text-slate-400">{etape.provisoire}</span>
            {!etape.texte && !etape.provisoire && (
              <span className="text-slate-400">Parlez, le texte s&apos;affiche ici…</span>
            )}
          </p>
        </div>
      )}

      {etape.nom === "erreur" && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-red-800">
            {etape.message}
          </p>
          <button
            type="button"
            onClick={() => setEtape({ nom: "pret" })}
            className={`${bouton} border border-slate-300 text-slate-700`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Recommencer
          </button>
        </div>
      )}

      {etape.nom === "relecture" && (
        <Relecture
          // Une nouvelle correction (Claude) repart d'une relecture vierge
          key={etape.parClaude ? "claude" : "gratuite"}
          langue={langue}
          brut={etape.brut}
          correction={etape.correction}
          parClaude={etape.parClaude}
          claude={claude}
          libellesValeurs={libellesValeurs}
          ameliore={(correction) => setEtape({ ...etape, correction, parClaude: true })}
          apprendre={(entendu, correct) => appris.current.push({ entendu, correct })}
          inserer={(c) => {
            inserer(c);
            setEtape({ nom: "pret" });
          }}
          annuler={() => setEtape({ nom: "pret" })}
        />
      )}
    </section>
  );
}

function Relecture({
  langue,
  brut,
  correction,
  parClaude,
  claude,
  libellesValeurs,
  ameliore,
  apprendre,
  inserer,
  annuler,
}: {
  langue: string;
  brut: string;
  correction: Correction;
  parClaude: boolean;
  claude: boolean;
  libellesValeurs: Record<string, string>;
  ameliore: (c: Correction) => void;
  apprendre: (entendu: string, correct: string) => void;
  inserer: (c: Correction) => void;
  annuler: () => void;
}) {
  const [textes, setTextes] = useState(correction.rubriques);
  const [appris, setAppris] = useState<Record<string, string>>({});
  const [claudeEnCours, setClaudeEnCours] = useState(false);
  const [erreurClaude, setErreurClaude] = useState("");
  const valeurs = Object.entries(correction.valeurs);
  const champ =
    "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

  async function ameliorer() {
    setClaudeEnCours(true);
    setErreurClaude("");
    try {
      const reponse = await fetch("/api/dictee/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte: brut }),
      });
      const resultat = (await reponse.json().catch(() => ({}))) as Correction & { erreur?: string };
      if (!reponse.ok) throw new Error(resultat.erreur ?? "Erreur inattendue.");
      ameliore(resultat);
    } catch (e) {
      setErreurClaude(e instanceof Error ? e.message : "Erreur inattendue.");
      setClaudeEnCours(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">
          Relecture de la dictée{" "}
          <span className="font-normal text-slate-500">
            ({parClaude ? "améliorée par Claude" : "correction gratuite"})
          </span>
        </h3>
        {claude && !parClaude && (
          <button
            type="button"
            onClick={ameliorer}
            disabled={claudeEnCours}
            className="inline-flex items-center gap-2 rounded-full border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
          >
            {claudeEnCours ? (
              <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3 w-3" aria-hidden />
            )}
            Améliorer avec Claude <span className="font-normal text-violet-600">(≈ 2 centimes)</span>
          </button>
        )}
      </div>
      {erreurClaude && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">
          {erreurClaude}
        </p>
      )}

      {correction.incertains.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3">
          <p className="font-medium text-amber-900">Mots à vérifier</p>
          <ul className="mt-2 space-y-2">
            {correction.incertains.map((m) => (
              <li key={m.entendu} className="flex flex-wrap items-center gap-2 text-amber-900">
                <span>
                  « {m.entendu} » → <strong>{m.propose}</strong>
                </span>
                {appris[m.entendu] ? (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <Check className="h-3 w-3" aria-hidden />
                    retenu : {appris[m.entendu]}
                  </span>
                ) : (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const correct = String(new FormData(e.currentTarget).get("correct") ?? "");
                      if (await ajouterAuLexique(langue, m.entendu, correct)) {
                        apprendre(m.entendu, correct);
                        setAppris((a) => ({ ...a, [m.entendu]: correct }));
                      }
                    }}
                  >
                    <label className="sr-only" htmlFor={`lexique-${m.entendu}`}>
                      Forme correcte de « {m.entendu} »
                    </label>
                    <input
                      id={`lexique-${m.entendu}`}
                      name="correct"
                      defaultValue={m.propose}
                      className="w-40 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-amber-100"
                    >
                      <BookPlus className="h-3 w-3" aria-hidden />
                      Retenir dans le lexique
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {valeurs.length > 0 && (
        <p className="text-slate-700">
          <span className="font-medium">Valeurs reconnues : </span>
          {valeurs.map(([cle, v]) => `${libellesValeurs[cle] ?? cle} ${String(v).replace(".", ",")}`).join(" · ")}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(libelles) as Rubrique[])
          .filter((r) => textes[r])
          .map((r) => (
            <label key={r} className="font-medium text-slate-700">
              {libelles[r]}
              <textarea
                value={textes[r]}
                onChange={(e) => setTextes((t) => ({ ...t, [r]: e.target.value }))}
                rows={3}
                className={champ}
              />
            </label>
          ))}
      </div>

      <details>
        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-900">
          Texte reconnu avant correction
        </summary>
        <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{brut}</p>
      </details>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inserer({ ...correction, rubriques: textes })}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Check className="h-4 w-4" aria-hidden />
          Insérer dans la consultation
        </button>
        <button
          type="button"
          onClick={annuler}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-slate-700"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Abandonner
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Le texte s&apos;ajoute aux rubriques du formulaire ; relisez puis « Enregistrer la consultation ».
      </p>
    </div>
  );
}

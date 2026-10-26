"use client";

import { useEffect, useRef, useState } from "react";
import { BookPlus, Check, LoaderCircle, Mic, RotateCcw, Square } from "lucide-react";
import type { Correction, Rubrique } from "../../../dossier/dictee";
import { ajouterAuLexique } from "../lexique/actions";

const DUREE_MAX = 5 * 60; // secondes
const FREQUENCE = 16000;
const MORCEAU = 50 * FREQUENCE; // la reconnaissance synchrone de Google accepte moins d'une minute par envoi

const libelles: Record<Rubrique, string> = {
  motif: "Motif",
  examen: "Examen clinique",
  ecg: "ECG",
  autres: "Autres",
  conclusion: "Conclusion",
  conduite: "Conduite à tenir",
};

// Audio enregistré (WebM, MP4…) → WAV 16 kHz mono, découpé en morceaux de 50 s
async function versWav(enregistrement: Blob) {
  const contexte = new AudioContext();
  const decode = await contexte.decodeAudioData(await enregistrement.arrayBuffer());
  await contexte.close();
  const hors = new OfflineAudioContext(1, Math.max(1, Math.ceil(decode.duration * FREQUENCE)), FREQUENCE);
  const source = hors.createBufferSource();
  source.buffer = decode;
  source.connect(hors.destination);
  source.start();
  const echantillons = (await hors.startRendering()).getChannelData(0);

  const morceaux: Blob[] = [];
  for (let debut = 0; debut < echantillons.length; debut += MORCEAU) {
    const partie = echantillons.subarray(debut, debut + MORCEAU);
    const vue = new DataView(new ArrayBuffer(44 + partie.length * 2));
    const ecrire = (pos: number, texte: string) => [...texte].forEach((c, i) => vue.setUint8(pos + i, c.charCodeAt(0)));
    ecrire(0, "RIFF");
    vue.setUint32(4, 36 + partie.length * 2, true);
    ecrire(8, "WAVE");
    ecrire(12, "fmt ");
    vue.setUint32(16, 16, true);
    vue.setUint16(20, 1, true); // PCM
    vue.setUint16(22, 1, true); // mono
    vue.setUint32(24, FREQUENCE, true);
    vue.setUint32(28, FREQUENCE * 2, true);
    vue.setUint16(32, 2, true);
    vue.setUint16(34, 16, true);
    ecrire(36, "data");
    vue.setUint32(40, partie.length * 2, true);
    partie.forEach((v, i) => vue.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
    morceaux.push(new Blob([vue], { type: "audio/wav" }));
  }
  return morceaux;
}

async function envoyer<T>(url: string, init: RequestInit): Promise<T> {
  const reponse = await fetch(url, init);
  const resultat = (await reponse.json().catch(() => ({}))) as T & { erreur?: string };
  if (!reponse.ok) throw new Error(resultat.erreur ?? "Erreur inattendue.");
  return resultat;
}

type Etape =
  | { nom: "pret" }
  | { nom: "enregistrement"; secondes: number }
  | { nom: "traitement"; message: string }
  | { nom: "relecture"; brut: string; correction: Correction }
  | { nom: "brut"; brut: string; erreur: string }
  | { nom: "erreur"; message: string };

// Dictée de toute la consultation : le texte corrigé est relu puis inséré dans le formulaire (rien n'est enregistré
// avant « Enregistrer la consultation »)
export function DicteeConsultation({
  langue,
  libellesValeurs,
  inserer,
}: {
  langue: string;
  libellesValeurs: Record<string, string>;
  inserer: (c: Correction) => void;
}) {
  const [etape, setEtape] = useState<Etape>({ nom: "pret" });
  const enregistreur = useRef<MediaRecorder | null>(null);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (minuteur.current) clearInterval(minuteur.current);
      enregistreur.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function commencer() {
    let flux: MediaStream;
    try {
      flux = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setEtape({ nom: "erreur", message: "Le micro n'est pas accessible : autorisez-le dans le navigateur." });
      return;
    }
    const morceaux: Blob[] = [];
    const recorder = new MediaRecorder(flux);
    recorder.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
    recorder.onstop = () => {
      flux.getTracks().forEach((t) => t.stop());
      traiter(new Blob(morceaux, { type: recorder.mimeType }));
    };
    enregistreur.current = recorder;
    recorder.start(1000);
    const debut = Date.now();
    setEtape({ nom: "enregistrement", secondes: 0 });
    minuteur.current = setInterval(() => {
      const secondes = Math.floor((Date.now() - debut) / 1000);
      if (secondes >= DUREE_MAX) arreter();
      else setEtape({ nom: "enregistrement", secondes });
    }, 500);
  }

  function arreter() {
    if (minuteur.current) clearInterval(minuteur.current);
    minuteur.current = null;
    if (enregistreur.current?.state === "recording") enregistreur.current.stop();
  }

  async function traiter(enregistrement: Blob) {
    let brut = "";
    try {
      setEtape({ nom: "traitement", message: "Préparation de l'audio…" });
      const morceaux = await versWav(enregistrement);
      const textes: string[] = [];
      for (const [i, morceau] of morceaux.entries()) {
        setEtape({
          nom: "traitement",
          message:
            morceaux.length > 1 ? `Reconnaissance vocale ${i + 1}/${morceaux.length}…` : "Reconnaissance vocale…",
        });
        const { texte } = await envoyer<{ texte: string }>("/api/dictee/transcription", {
          method: "POST",
          headers: { "Content-Type": "audio/wav" },
          body: morceau,
        });
        if (texte) textes.push(texte);
      }
      brut = textes.join(" ");
      if (!brut) {
        setEtape({ nom: "erreur", message: "Aucune parole reconnue. Parlez plus près du micro et recommencez." });
        return;
      }
      setEtape({ nom: "traitement", message: "Correction des termes de cardiologie…" });
      const correction = await envoyer<Correction>("/api/dictee/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte: brut }),
      });
      setEtape({ nom: "relecture", brut, correction });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inattendue.";
      setEtape(brut ? { nom: "brut", brut, erreur: message } : { nom: "erreur", message });
    }
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
      )}

      {etape.nom === "traitement" && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-700">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          {etape.message}
        </p>
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

      {etape.nom === "brut" && (
        <Relecture
          langue={langue}
          brut={etape.brut}
          avertissement={`${etape.erreur} Voici le texte tel qu'il a été reconnu.`}
          correction={{
            rubriques: { motif: "", examen: "", ecg: "", autres: "", conclusion: etape.brut, conduite: "" },
            valeurs: {},
            incertains: [],
          }}
          libellesValeurs={libellesValeurs}
          inserer={(c) => {
            inserer(c);
            setEtape({ nom: "pret" });
          }}
          annuler={() => setEtape({ nom: "pret" })}
        />
      )}

      {etape.nom === "relecture" && (
        <Relecture
          langue={langue}
          brut={etape.brut}
          correction={etape.correction}
          libellesValeurs={libellesValeurs}
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
  avertissement,
  libellesValeurs,
  inserer,
  annuler,
}: {
  langue: string;
  brut: string;
  correction: Correction;
  avertissement?: string;
  libellesValeurs: Record<string, string>;
  inserer: (c: Correction) => void;
  annuler: () => void;
}) {
  const [textes, setTextes] = useState(correction.rubriques);
  const [appris, setAppris] = useState<Record<string, string>>({});
  const valeurs = Object.entries(correction.valeurs);
  const champ =
    "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

  return (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold text-slate-900">Relecture de la dictée</h3>
      {avertissement && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">
          {avertissement}
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

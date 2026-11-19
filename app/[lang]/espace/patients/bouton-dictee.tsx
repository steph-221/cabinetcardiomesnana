"use client";

import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Moteur, type Reconnaissance } from "./dictee";

// Micro à poser à côté d'une case de texte : la parole (reconnaissance vocale du navigateur, gratuite) s'ajoute au texte
export function BoutonDictee({ ajouter }: { ajouter: (texte: string) => void }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const reconnaissance = useRef<Reconnaissance | null>(null);
  const actif = useRef(false);

  function commencer() {
    const Classe = Moteur();
    if (!Classe) {
      setErreur("Ce navigateur ne sait pas dicter : utilisez Chrome, Edge ou Safari.");
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
      if (ajout.trim()) ajouter(ajout.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        actif.current = false;
        setEnCours(false);
        setErreur("Le micro n'est pas autorisé : autorisez-le dans le navigateur.");
      }
    };
    // Le navigateur s'arrête après un silence : on relance tant que le médecin n'a pas arrêté
    r.onend = () => {
      if (actif.current) r.start();
      else setEnCours(false);
    };
    reconnaissance.current = r;
    actif.current = true;
    setEnCours(true);
    r.start();
  }

  function arreter() {
    actif.current = false;
    reconnaissance.current?.stop();
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={enCours ? arreter : commencer}
        aria-pressed={enCours}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
          enCours ? "border-red-600 bg-red-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"
        }`}
      >
        {enCours ? <Square className="h-3 w-3" aria-hidden /> : <Mic className="h-3 w-3" aria-hidden />}
        {enCours ? "Arrêter la dictée" : "Dicter"}
      </button>
      {erreur && (
        <span role="alert" className="text-xs text-red-700">
          {erreur}
        </span>
      )}
    </span>
  );
}

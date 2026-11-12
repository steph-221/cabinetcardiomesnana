"use client";

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";

// Après « Enregistrer et imprimer » : le PDF du document qui vient d'être enregistré s'imprime sans quitter le dossier.
// `?imprimer=…` est retiré de l'adresse aussitôt, pour qu'un rechargement ne relance pas l'impression.
export function ImpressionAuto({ message, adresse }: { message: string; adresse: string }) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [auto, setAuto] = useState(true);

  // `history.replaceState` met à jour l'adresse sans redemander la page au serveur : le bandeau et l'impression restent
  useEffect(() => {
    const adresseCourante = new URL(window.location.href);
    adresseCourante.searchParams.delete("imprimer");
    adresseCourante.searchParams.delete("format");
    adresseCourante.searchParams.delete("entete");
    window.history.replaceState(null, "", adresseCourante);
  }, []);

  function imprimer() {
    try {
      cadre.current?.contentWindow?.focus();
      cadre.current?.contentWindow?.print();
    } catch {
      window.open(adresse, "_blank", "noopener");
    }
  }

  return (
    <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg bg-green-50 p-4 text-sm text-green-900">
      <span className="font-medium">{message}</span>
      <span>{auto ? "La fenêtre d'impression s'ouvre…" : ""}</span>
      <button
        type="button"
        onClick={imprimer}
        className="inline-flex items-center gap-1 rounded-full border border-green-700 px-3 py-1 text-xs font-medium hover:bg-green-100"
      >
        <Printer className="h-3 w-3" aria-hidden />
        Imprimer à nouveau
      </button>
      <a href={adresse} target="_blank" rel="noopener" className="text-xs underline">
        Ouvrir le PDF
      </a>
      <iframe
        ref={cadre}
        src={adresse}
        title="Document à imprimer"
        className="absolute h-0 w-0 border-0"
        onLoad={() => {
          if (auto) {
            setAuto(false);
            imprimer();
          }
        }}
      />
    </div>
  );
}

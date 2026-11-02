"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HardDriveDownload, Pause, Play, RefreshCw, Square } from "lucide-react";
import { activerCopieSite, arreterCopieSite, mettreAJourCopie } from "./actions";

const petit = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50";

type Lot = { faites: { titre: string; statut: string; erreur: string }[]; restantes: number } | { erreur: string };

export type ResumeCopie = {
  active: boolean;
  enFile: number;
  pages: number;
  fichiers: number;
  indexees: number;
  bloquees: number;
  erreurs: number;
  derniere: string | null;
};

// Copie privée d'un site suivi dans le Google Drive du cabinet. La page lance les lots de copie l'un après
// l'autre tant qu'il reste des adresses, et reprend toute seule une copie inachevée à l'ouverture.
export function CopieSite({
  langue,
  id,
  nom,
  resume,
  driveConnecte,
}: {
  langue: string;
  id: number;
  nom: string;
  resume: ResumeCopie;
  driveConnecte: boolean;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [restantes, setRestantes] = useState(resume.enFile);
  const [action, demarrer] = useTransition();
  const actif = useRef(false);
  const pause = useRef(false);

  async function copier() {
    if (actif.current) return;
    actif.current = true;
    pause.current = false;
    setEnCours(true);
    setMessage("");
    try {
      let echecs = 0;
      for (;;) {
        // Un appel coupé par le serveur (délai dépassé) n'arrête pas la copie : l'adresse sera reprise
        const lot = await fetch("/api/bibliotheque/copie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site: id }),
        })
          .then(async (reponse) => {
            if (reponse.status === 401 || reponse.status === 403) throw new Error(await reponse.text());
            if (!reponse.ok) return null;
            return (await reponse.json()) as Lot;
          })
          .catch((erreur: unknown) => {
            if (erreur instanceof Error && erreur.message.length < 200 && !/fetch/i.test(erreur.message)) throw erreur;
            return null;
          });
        if (!lot) {
          if (++echecs >= 4) throw new Error("Le serveur ne répond pas. Cliquez sur Reprendre dans un instant.");
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        echecs = 0;
        if ("erreur" in lot) {
          setMessage(lot.erreur);
          break;
        }
        setRestantes(lot.restantes);
        const derniere = lot.faites.at(-1);
        if (derniere) setMessage(`Dernière adresse traitée : ${derniere.titre}`);
        router.refresh();
        if (lot.restantes === 0 || pause.current || !lot.faites.length) break;
      }
    } catch (erreur) {
      setMessage(
        erreur instanceof Error && erreur.message.length < 200 ? erreur.message : "La copie s'est interrompue.",
      );
    } finally {
      actif.current = false;
      setEnCours(false);
      router.refresh();
    }
  }

  // Reprise automatique d'une copie inachevée (nouvelles publications, lot interrompu)
  const aReprendre = resume.active && resume.enFile > 0 && driveConnecte;
  useEffect(() => {
    if (!aReprendre) return;
    const minuterie = setTimeout(() => void copier(), 500);
    return () => clearTimeout(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aReprendre]);

  if (!driveConnecte) {
    return (
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        Copie privée dans Google Drive : l&apos;administrateur doit d&apos;abord connecter Google Drive (page{" "}
        <Link href={`/${langue}/espace/drive`} className="text-red-700 underline">
          Google Drive
        </Link>
        ).
      </p>
    );
  }

  if (!resume.active) {
    return (
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <button
          type="button"
          disabled={action}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          onClick={() =>
            demarrer(async () => {
              await activerCopieSite(langue, id);
              void copier();
            })
          }
        >
          <HardDriveDownload className="h-3.5 w-3.5" aria-hidden />
          Copier le site dans Google Drive
        </button>
        <p className="mt-2">
          Copie privée, pour le cabinet seulement : la page de liste, chaque publication (page HTML complète, avec ses
          images) et les documents qu&apos;elle propose (PDF, diaporamas…). Le texte des publications entre dans la
          bibliothèque, pour que l&apos;assistant puisse le citer. Rien n&apos;est publié ni partagé.
        </p>
      </div>
    );
  }

  const enAttente = enCours ? restantes : resume.enFile;
  return (
    <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1 font-medium">
          <HardDriveDownload className="h-3.5 w-3.5" aria-hidden />
          Copie privée dans Google Drive
          {enCours && <RefreshCw className="ms-1 h-3 w-3 animate-spin" aria-hidden />}
          {enCours && <span className="font-normal">en cours, environ 15 secondes par page</span>}
        </p>
        <div className="flex flex-wrap gap-1">
          {enCours ? (
            <button type="button" className={`${petit} text-emerald-900`} onClick={() => (pause.current = true)}>
              <Pause className="h-3 w-3" aria-hidden />
              Pause
            </button>
          ) : (
            <>
              {enAttente > 0 && (
                <button type="button" className={`${petit} text-emerald-900`} onClick={() => void copier()}>
                  <Play className="h-3 w-3" aria-hidden />
                  Reprendre
                </button>
              )}
              <button
                type="button"
                disabled={action}
                className={`${petit} text-emerald-900`}
                onClick={() =>
                  demarrer(async () => {
                    await mettreAJourCopie(langue, id);
                    void copier();
                  })
                }
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Mettre à jour la copie
              </button>
            </>
          )}
          <button
            type="button"
            disabled={action}
            className={`${petit} text-red-700 hover:bg-red-50`}
            onClick={() => {
              if (!confirm(`Arrêter la copie de « ${nom} » ? Les copies déjà faites restent dans Google Drive.`))
                return;
              pause.current = true;
              demarrer(() => arreterCopieSite(langue, id));
            }}
          >
            <Square className="h-3 w-3" aria-hidden />
            Arrêter
          </button>
        </div>
      </div>
      <p className="mt-1">
        {[
          `${resume.pages} page(s)`,
          `${resume.fichiers} fichier(s)`,
          `${resume.indexees} dans la bibliothèque`,
          resume.bloquees ? `${resume.bloquees} bloquée(s) par le site` : "",
          resume.erreurs ? `${resume.erreurs} erreur(s)` : "",
          enAttente ? `${enAttente} en attente` : "copie à jour",
          resume.derniere ? `dernière copie le ${resume.derniere}` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {message && (
        <p role="status" className="mt-1 text-emerald-800">
          {message}
        </p>
      )}
    </div>
  );
}

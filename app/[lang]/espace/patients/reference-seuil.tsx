"use client";

import { ExternalLink, FileSearch, TriangleAlert } from "lucide-react";
import { trouverSeuil, type ReferenceSeuil } from "../../../dossier/comptes-rendus/seuils";
import { lienPage } from "../../../dossier/sources";

// Sous une proposition : la phrase de la recommandation, le lien vers le passage et vers le document à la bonne page,
// et l'état de validation. L'assistant propose ; seul le médecin valide.
export function LigneReference({
  langue,
  id,
  reference,
}: {
  langue: string;
  id: string;
  reference?: ReferenceSeuil;
}) {
  const seuil = trouverSeuil(id);
  const lienVerification = `/${langue}/espace/seuils#${id}`;
  if (!reference?.citation || !reference.passageId) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-amber-800">
        <TriangleAlert className="h-3 w-3" aria-hidden />
        Source non retrouvée dans la bibliothèque : {seuil?.source ?? id}.
        <a href={lienVerification} target="_blank" rel="noopener noreferrer" className="underline">
          Vérifier cette règle
        </a>
      </p>
    );
  }
  const etat =
    reference.valide === "conforme"
      ? { texte: `Validé par ${reference.validePar}`, classe: "bg-green-50 text-green-800" }
      : reference.valide === "a_corriger"
        ? { texte: "À corriger", classe: "bg-red-50 text-red-800" }
        : reference.verdict === "contredit"
          ? { texte: "La source dit autre chose : à vérifier", classe: "bg-red-50 text-red-800" }
          : { texte: "Proposé, à valider par vous", classe: "bg-amber-50 text-amber-900" };
  return (
    <div className="mt-1 text-xs text-slate-600">
      <p>
        <span className="italic">« {reference.citation} »</span> — {reference.sourceTitre}
        {reference.page ? `, p. ${reference.page}` : ""}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-2 py-0.5 ${etat.classe}`}>{etat.texte}</span>
        <a
          href={`/${langue}/espace/bibliotheque/passage/${reference.passageId}?cite=${encodeURIComponent(reference.citation)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-red-700 underline"
        >
          <FileSearch className="h-3 w-3" aria-hidden />
          Voir le passage
        </a>
        {reference.url && (
          <a
            href={lienPage(reference.url, reference.page)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-red-700 underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            {reference.page ? `Ouvrir le document, page ${reference.page}` : "Ouvrir le document"}
          </a>
        )}
      </p>
    </div>
  );
}

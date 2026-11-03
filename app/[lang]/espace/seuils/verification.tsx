"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, FileSearch, LoaderCircle, Search, TriangleAlert, Undo2 } from "lucide-react";
import type { ReferenceSeuil, Seuil } from "../../../dossier/comptes-rendus/seuils";
import { lienPage } from "../../../dossier/sources";
import { chercherReference, decider } from "./actions";

const verdicts: Record<ReferenceSeuil["verdict"], { texte: string; classe: string }> = {
  confirme: { texte: "La source confirme", classe: "bg-green-50 text-green-800" },
  contredit: { texte: "La source dit autre chose", classe: "bg-red-50 text-red-800" },
  non_tranche: { texte: "Non tranché", classe: "bg-slate-100 text-slate-700" },
  aucune_source: { texte: "Aucune source trouvée", classe: "bg-amber-50 text-amber-900" },
};

export function VerificationSeuils({
  langue,
  seuils,
  initiales,
  claude,
}: {
  langue: string;
  seuils: Seuil[];
  initiales: Record<string, ReferenceSeuil>;
  claude: boolean;
}) {
  const [references, setReferences] = useState(initiales);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [toutEnCours, setToutEnCours] = useState(false);
  const [, demarrer] = useTransition();
  const examens = [...new Set(seuils.map((s) => s.examen))];
  const [filtre, setFiltre] = useState("");

  const valides = seuils.filter((s) => references[s.id]?.valide === "conforme").length;

  async function chercher(id: string) {
    setEnCours(id);
    setErreurs((e) => ({ ...e, [id]: "" }));
    const r = await chercherReference(langue, id);
    if ("erreur" in r) setErreurs((e) => ({ ...e, [id]: r.erreur }));
    else setReferences((x) => ({ ...x, [id]: r.reference }));
    setEnCours(null);
  }

  async function toutChercher() {
    setToutEnCours(true);
    for (const s of seuils.filter((x) => !references[x.id])) await chercher(s.id);
    setToutEnCours(false);
  }

  function decision(id: string, valeur: ReferenceSeuil["valide"], commentaire: string) {
    demarrer(async () => {
      const r = await decider(langue, id, valeur, commentaire);
      if ("erreur" in r) setErreurs((e) => ({ ...e, [id]: r.erreur }));
      else setReferences((x) => ({ ...x, [id]: r.reference }));
    });
  }

  return (
    <div className="mt-6 space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-slate-700">
          <strong>{valides}</strong> règle{valides > 1 ? "s" : ""} validée{valides > 1 ? "s" : ""} par un médecin sur{" "}
          {seuils.length}
        </p>
        <select
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          aria-label="Examen"
          className="ms-auto rounded-lg border border-slate-300 bg-white px-2 py-1.5"
        >
          <option value="">Tous les examens</option>
          {examens.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={toutChercher}
          disabled={!claude || toutEnCours || enCours !== null}
          className="inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-2 font-medium text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {toutEnCours ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          Chercher les règles sans résultat
        </button>
      </div>
      {!claude && (
        <p role="note" className="rounded-lg bg-amber-50 p-3 text-amber-900">
          Claude n&apos;est pas configuré (clé ANTHROPIC_API_KEY) : la recherche automatique est indisponible. Vous pouvez
          néanmoins valider une règle après l&apos;avoir relue dans le document.
        </p>
      )}

      <ul className="space-y-3">
        {seuils
          .filter((s) => !filtre || s.examen === filtre)
          .map((s) => {
            const r = references[s.id];
            return (
              <li key={s.id} id={s.id} className="scroll-mt-6 rounded-xl border border-slate-200 p-4 target:border-red-300 target:ring-2 target:ring-red-100">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{s.examen}</span>
                  <span className="font-semibold text-slate-900">{s.sujet}</span>
                  {s.confiance === "à confirmer" && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">à confirmer</span>
                  )}
                  {r?.valide === "conforme" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800">
                      <Check className="h-3 w-3" aria-hidden />
                      Validé par {r.validePar}
                    </span>
                  )}
                  {r?.valide === "a_corriger" && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800">À corriger</span>
                  )}
                </p>
                <p className="mt-2 text-slate-800">{s.regle}</p>
                <p className="mt-1 text-xs text-slate-500">Source citée par l&apos;application : {s.source}</p>

                {r && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${verdicts[r.verdict].classe}`}>{verdicts[r.verdict].texte}</span>
                      <span className="text-slate-700">{r.explication}</span>
                    </p>
                    {r.citation && r.passageId && (
                      <>
                        <p className="mt-2 italic text-slate-800">« {r.citation} »</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {r.sourceTitre}
                          {r.page ? `, p. ${r.page}` : ""}
                        </p>
                        <p className="mt-2 flex flex-wrap gap-4 text-xs">
                          <a
                            href={`/${langue}/espace/bibliotheque/passage/${r.passageId}?cite=${encodeURIComponent(r.citation)}`}
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
                        </p>
                      </>
                    )}
                  </div>
                )}

                {erreurs[s.id] && (
                  <p role="alert" className="mt-2 flex items-center gap-1 text-amber-900">
                    <TriangleAlert className="h-4 w-4" aria-hidden />
                    {erreurs[s.id]}
                  </p>
                )}

                <form
                  className="mt-3 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    onClick={() => chercher(s.id)}
                    disabled={!claude || enCours !== null || toutEnCours}
                    className="inline-flex items-center gap-1 rounded-full border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                  >
                    {enCours === s.id ? <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden /> : <Search className="h-3 w-3" aria-hidden />}
                    {r ? "Chercher à nouveau" : "Chercher dans la bibliothèque"}
                  </button>
                  <label className="sr-only" htmlFor={`commentaire-${s.id}`}>
                    Commentaire
                  </label>
                  <input
                    id={`commentaire-${s.id}`}
                    name="commentaire"
                    defaultValue={r?.commentaire ?? ""}
                    maxLength={500}
                    placeholder="Commentaire (valeur correcte, page…)"
                    className="min-w-48 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const champ = e.currentTarget.form?.elements.namedItem("commentaire");
                      decision(s.id, "conforme", champ instanceof HTMLInputElement ? champ.value : "");
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                  >
                    <Check className="h-3 w-3" aria-hidden />
                    Je valide
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      const champ = e.currentTarget.form?.elements.namedItem("commentaire");
                      decision(s.id, "a_corriger", champ instanceof HTMLInputElement ? champ.value : "");
                    }}
                    className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
                  >
                    À corriger
                  </button>
                  {r?.valide && (
                    <button
                      type="button"
                      onClick={() => decision(s.id, "", "")}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      <Undo2 className="h-3 w-3" aria-hidden />
                      Retirer ma décision
                    </button>
                  )}
                </form>
                {r?.commentaire && r.valide && <p className="mt-2 text-xs text-slate-600">Commentaire : {r.commentaire}</p>}
              </li>
            );
          })}
      </ul>
    </div>
  );
}

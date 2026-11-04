// Ce qui se rapporte à une consultation : calculs faits pendant la consultation, examens et résultats reçus,
// ordonnances, facture. Tout se rattache seul au jour même ; ici on vérifie, on rattache ou on détache.

import Link from "next/link";
import { Calculator, ExternalLink, FilePlus2, FileText, Printer, Receipt, ScrollText } from "lucide-react";
import { catalogueScores, type ScorePatient } from "../../../dossier/scores-patients";
import type { DonneesDossier } from "../../../dossier/calculateurs/preremplissage";
import type { Consultation } from "../../../dossier/consultations";
import type { Examen } from "../../../dossier/examens";
import type { Facture } from "../../../dossier/compta";
import { libelleStatut, mad } from "../../../dossier/compta-calculs";
import type { Ordonnance } from "../../../dossier/ordonnances";
import type { Resultat } from "../../../dossier/resultats";
import { couleurStatut } from "../comptabilite/commun";
import { BoutonDetacher, RattacherExistant, type ChoixRattachement } from "./liens-formulaire";
import { FormulaireScore } from "./scores-formulaire";

const jour = (d: string) => d.split("-").reverse().join("/");
const lien =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-100";

const libelleResultat: Record<Resultat["statut"], string> = {
  a_classer: "reçu par e-mail, à classer",
  a_relire: "reçu par e-mail, à relire",
  valide: "reçu par e-mail, validé",
  ignore: "reçu par e-mail",
};

function Titre({ icone, children, nombre }: { icone: React.ReactNode; children: React.ReactNode; nombre: number }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
      {icone}
      {children}
      <span className="text-xs font-normal text-slate-500">{nombre}</span>
    </h3>
  );
}

export function ElementsConsultation({
  langue,
  patientId,
  consultation,
  donnees,
  scores,
  examens,
  ordonnances,
  factures,
  resultats,
}: {
  langue: string;
  patientId: number;
  consultation: Consultation;
  donnees: DonneesDossier;
  scores: ScorePatient[];
  examens: Examen[];
  ordonnances: Ordonnance[];
  factures: Facture[];
  resultats: Map<number, { labo: string; statut: Resultat["statut"] }>;
}) {
  const ici = (e: { consultationId: number | null }) => e.consultationId === consultation.id;
  const libres = (e: { consultationId: number | null }) => e.consultationId === null;
  const base = `/${langue}/espace`;

  // Éléments du dossier qui ne sont rattachés à aucune consultation
  const choix: ChoixRattachement[] = [
    ...scores.filter(libres).map((s) => ({
      valeur: `score:${s.id}`,
      groupe: "Calculs",
      libelle: `${s.titre} du ${jour(s.date)}${s.score !== null ? ` — score ${s.score}` : ""}`,
    })),
    ...examens.filter(libres).map((e) => ({ valeur: `examen:${e.id}`, groupe: "Examens", libelle: `${e.type} du ${jour(e.date)}` })),
    ...ordonnances.filter(libres).map((o) => ({
      valeur: `ordonnance:${o.id}`,
      groupe: "Ordonnances",
      libelle: `Ordonnance du ${jour(o.date)} — ${o.lignes.map((l) => l.medicament).join(", ")}`,
    })),
    ...factures.filter(libres).map((f) => ({
      valeur: `facture:${f.id}`,
      groupe: "Factures",
      libelle: `Facture ${f.numero} du ${jour(f.date)} — ${mad(f.totalCts)}`,
    })),
  ];

  const mesScores = scores.filter(ici);
  const mesExamens = examens.filter(ici);
  const mesOrdonnances = ordonnances.filter(ici);
  const mesFactures = factures.filter(ici);

  return (
    <section className="mb-8 rounded-2xl border border-slate-200 p-6 text-sm" aria-label="Rattaché à cette consultation">
      <h2 className="text-lg font-semibold text-slate-900">Rattaché à cette consultation</h2>
      <p className="mt-1 text-xs text-slate-500">
        Les calculs, examens, ordonnances et factures du même jour s&apos;y rattachent tout seuls. Vous pouvez en
        rattacher ou en détacher à la main.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`${base}/patients/${patientId}/ordonnance`} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          <FilePlus2 className="h-4 w-4" aria-hidden />
          Ordonnance
        </Link>
        <Link href={`${base}/comptabilite/factures/nouvelle?patient=${patientId}`} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          <Receipt className="h-4 w-4" aria-hidden />
          Facturer
        </Link>
        <Link href={`${base}/patients/${patientId}?onglet=examens`} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          <FileText className="h-4 w-4" aria-hidden />
          Examens
        </Link>
      </div>

      <div className="mt-6 space-y-6">
        <div>
          <Titre icone={<Calculator className="h-4 w-4 text-red-600" aria-hidden />} nombre={mesScores.length}>
            Calculs
          </Titre>
          {mesScores.length > 0 && (
            <ul className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {mesScores.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    <span className="font-medium text-slate-900">{s.titre}</span>
                    <span className="ms-2 text-slate-700">
                      {s.score !== null && <>score {s.score} · </>}
                      {s.libelle}
                    </span>
                  </span>
                  <BoutonDetacher langue={langue} patientId={patientId} type="score" id={s.id} />
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-slate-700">Faire un calcul pendant cette consultation</summary>
            <div className="mt-3">
              <FormulaireScore
                langue={langue}
                patientId={patientId}
                catalogue={catalogueScores}
                dateInitiale={consultation.date}
                donnees={donnees}
                consultationId={consultation.id}
              />
            </div>
          </details>
        </div>

        <div>
          <Titre icone={<FileText className="h-4 w-4 text-red-600" aria-hidden />} nombre={mesExamens.length}>
            Examens et résultats reçus
          </Titre>
          {mesExamens.length === 0 ? (
            <p className="text-slate-500">Aucun examen rattaché.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {mesExamens.map((e) => {
                const resultat = resultats.get(e.id);
                const compteRendu = Boolean(e.valeurs.ett || e.valeurs.cr);
                return (
                  <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p>
                        <span className="font-mono text-slate-600">{jour(e.date)}</span>
                        <span className="ms-2 font-medium text-slate-900">{e.type}</span>
                        {resultat && (
                          <span className="ms-2 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">
                            {libelleResultat[resultat.statut]}
                            {resultat.labo && ` · ${resultat.labo}`}
                          </span>
                        )}
                      </p>
                      {e.conclusion && <p className="mt-1 whitespace-pre-line text-slate-700">{e.conclusion}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {compteRendu && (
                        <a href={`/api/examens/${e.id}/compte-rendu`} target="_blank" rel="noopener" className={lien}>
                          <Printer className="h-3 w-3" aria-hidden />
                          Compte rendu
                        </a>
                      )}
                      {e.fichierDrive && !compteRendu && (
                        <a href={`/api/fichiers/${e.id}`} target="_blank" rel="noopener" className={lien}>
                          <ExternalLink className="h-3 w-3" aria-hidden />
                          Ouvrir
                        </a>
                      )}
                      <BoutonDetacher langue={langue} patientId={patientId} type="examen" id={e.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <Titre icone={<ScrollText className="h-4 w-4 text-red-600" aria-hidden />} nombre={mesOrdonnances.length}>
            Ordonnances
          </Titre>
          {mesOrdonnances.length === 0 ? (
            <p className="text-slate-500">Aucune ordonnance rattachée.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {mesOrdonnances.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    <span className="font-mono text-slate-600">{jour(o.date)}</span>
                    <span className="ms-2 text-slate-900">{o.lignes.map((l) => l.medicament).join(" · ")}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <a href={`/api/ordonnances/${o.id}/pdf`} target="_blank" rel="noopener" className={lien}>
                      <Printer className="h-3 w-3" aria-hidden />
                      Imprimer
                    </a>
                    <BoutonDetacher langue={langue} patientId={patientId} type="ordonnance" id={o.id} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <Titre icone={<Receipt className="h-4 w-4 text-red-600" aria-hidden />} nombre={mesFactures.length}>
            Facture
          </Titre>
          {mesFactures.length === 0 ? (
            <p className="text-slate-500">Aucune facture rattachée.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {mesFactures.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>
                    <Link href={`${base}/comptabilite/factures/${f.id}`} className="font-mono text-red-700 hover:underline">
                      {f.numero}
                    </Link>
                    <span className="ms-2 tabular-nums text-slate-900">{mad(f.totalCts)}</span>
                    <span className={`ms-2 rounded-full px-2 py-0.5 text-xs ${couleurStatut[f.statut]}`}>
                      {libelleStatut[f.statut]}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <a href={`/api/factures/${f.id}/pdf`} target="_blank" rel="noopener" className={lien}>
                      <Printer className="h-3 w-3" aria-hidden />
                      PDF
                    </a>
                    <BoutonDetacher langue={langue} patientId={patientId} type="facture" id={f.id} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <RattacherExistant langue={langue} patientId={patientId} consultationId={consultation.id} choix={choix} />
      </div>
    </section>
  );
}

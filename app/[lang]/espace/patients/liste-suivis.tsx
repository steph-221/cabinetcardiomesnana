// Lignes de suivis (dossier du patient et page « Suivis »), avec l'état de relance et les actions

import Link from "next/link";
import { cabinet } from "../../../cabinet";
import { relanceWhatsApp, type SuiviPatient } from "../../../dossier/suivis";
import { ActionsSuivi } from "./suivis";

const jour = (d: string) => d.split("-").reverse().join("/");

export function LigneSuivi({
  langue,
  suivi,
  aujourdhui,
  avecPatient,
}: {
  langue: string;
  suivi: SuiviPatient;
  aujourdhui: string;
  avecPatient: boolean;
}) {
  const retard = suivi.statut !== "fait" && suivi.echeance < aujourdhui;
  const quand = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: cabinet.fuseau }).format(d);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div>
        <p>
          <span className={`font-mono ${retard ? "font-semibold text-red-700" : "text-slate-600"}`}>
            {jour(suivi.echeance)}
          </span>
          {avecPatient && (
            <Link
              href={`/${langue}/espace/patients/${suivi.patientId}`}
              className="ms-3 font-medium text-slate-900 hover:text-red-700"
            >
              {[suivi.nom.toUpperCase(), suivi.prenom].filter(Boolean).join(" ")}
            </Link>
          )}
          <span className={`ms-3 ${suivi.statut === "fait" ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {suivi.quoi}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {retard && <span className="me-2 font-medium text-red-700">en retard</span>}
          {suivi.statut === "relance" && suivi.relanceLe && (
            <span>
              relancé le {quand(suivi.relanceLe)}
              {suivi.relancePar && ` par ${suivi.relancePar}`}
            </span>
          )}
          {suivi.statut === "fait" && <span>fait</span>}
          {avecPatient && suivi.telephone && <span className="ms-2">{suivi.telephone}</span>}
        </p>
      </div>
      <ActionsSuivi
        langue={langue}
        patientId={suivi.patientId}
        id={suivi.id}
        statut={suivi.statut}
        whatsapp={relanceWhatsApp(suivi)}
      />
    </li>
  );
}

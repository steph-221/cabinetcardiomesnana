import type { StatutFacture } from "../../../dossier/compta-calculs";

export const couleurStatut: Record<StatutFacture, string> = {
  payee: "bg-green-50 text-green-800",
  partielle: "bg-amber-50 text-amber-800",
  impayee: "bg-red-50 text-red-700",
  annulee: "bg-slate-100 text-slate-500",
};

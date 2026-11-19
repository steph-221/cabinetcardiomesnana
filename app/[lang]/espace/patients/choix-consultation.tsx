// Choix de la consultation concernée dans un formulaire. Sans choix, l'élément se rattache tout seul à la
// consultation du même jour quand elle est unique. Masqué quand le patient n'a aucune consultation.

import { libelleConsultation, type OptionConsultation } from "../../../dossier/choix-consultation";

const champ =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

export function ChoixConsultation({
  consultations,
  defaut,
  valeur,
  surChangement,
  className = "",
}: {
  consultations: OptionConsultation[];
  defaut?: number;
  // Pour un formulaire sans <form> (valeur suivie par le composant parent)
  valeur?: string;
  surChangement?: (valeur: string) => void;
  className?: string;
}) {
  if (!consultations.length) return null;
  const commun = { name: "consultationId", className: champ, "aria-describedby": "aide-consultation" };
  const options = (
    <>
      <option value="">Automatique (consultation du même jour)</option>
      {consultations.map((c) => (
        <option key={c.id} value={c.id}>
          {libelleConsultation(c)}
        </option>
      ))}
      <option value="aucune">Aucune consultation</option>
    </>
  );
  return (
    <label className={`text-sm font-medium text-slate-700 ${className}`}>
      Consultation concernée
      {valeur !== undefined ? (
        <select {...commun} value={valeur} onChange={(e) => surChangement?.(e.target.value)}>
          {options}
        </select>
      ) : (
        <select {...commun} defaultValue={defaut ?? ""}>
          {options}
        </select>
      )}
      <span id="aide-consultation" className="mt-1 block text-xs font-normal text-slate-500">
        Rattache cet élément à une consultation. Automatique : celle du même jour, s&apos;il n&apos;y en a qu&apos;une.
      </span>
    </label>
  );
}

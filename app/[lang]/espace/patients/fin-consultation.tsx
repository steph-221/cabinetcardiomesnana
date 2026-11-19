import Link from "next/link";
import { Check, FileText, Mail, Pill, Receipt } from "lucide-react";

// Gestes de fin de consultation, en un clic chacun : l'ordonnance, la facture déjà préparée d'après les actes du jour, le
// courrier au confrère et le rapport PDF. Rien n'est créé ici : chaque lien ouvre l'écran où le médecin vérifie.
export function FinConsultation({
  langue,
  patientId,
  consultationId,
  actesFacture,
  factureExistante,
}: {
  langue: string;
  patientId: number;
  consultationId: number;
  actesFacture: number[];
  factureExistante: { id: number; numero: string } | null;
}) {
  const base = `/${langue}/espace`;
  const lien = "inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50";
  const factureHref = `${base}/comptabilite/factures/nouvelle?${new URLSearchParams({
    patient: String(patientId),
    consultation: String(consultationId),
    ...(actesFacture.length ? { actes: actesFacture.join(",") } : {}),
  })}`;
  return (
    <section aria-label="Fin de consultation" className="mb-6 rounded-2xl border border-red-100 bg-red-50/40 p-4">
      <h2 className="text-sm font-semibold text-slate-900">Fin de consultation</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`${base}/patients/${patientId}/ordonnance?consultation=${consultationId}`} className={lien}>
          <Pill className="h-4 w-4" aria-hidden />
          Ordonnance
        </Link>
        {factureExistante ? (
          <Link href={`${base}/comptabilite/factures/${factureExistante.id}`} className={`${lien} border-emerald-300 text-emerald-800`}>
            <Check className="h-4 w-4" aria-hidden />
            Facture {factureExistante.numero}
          </Link>
        ) : (
          <Link href={factureHref} className={lien}>
            <Receipt className="h-4 w-4" aria-hidden />
            Facture proposée
          </Link>
        )}
        <Link href={`${base}/patients/${patientId}/courrier?consultation=${consultationId}`} className={lien}>
          <Mail className="h-4 w-4" aria-hidden />
          Courrier au confrère
        </Link>
        <a href={`/api/consultations/${consultationId}/pdf`} target="_blank" rel="noopener noreferrer" className={lien}>
          <FileText className="h-4 w-4" aria-hidden />
          Rapport PDF
        </a>
      </div>
    </section>
  );
}

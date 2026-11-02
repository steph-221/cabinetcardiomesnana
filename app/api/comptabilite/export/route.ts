// Livres de recettes et de dépenses en CSV pour le comptable (médecins seulement)

import { accesMedical, utilisateurConnecte } from "../../../agenda/session";
import { listerCharges, paiementsDeLaPeriode } from "../../../dossier/compta";
import { bornes, libelleMode, periodeValide } from "../../../dossier/compta-calculs";
import { journaliser } from "../../../dossier/journal";

// Séparateur « ; » et virgule décimale : s'ouvre directement dans Excel en français.
// Les cellules qui commencent par = + - @ sont neutralisées (injection de formules).
const cellule = (v: string | number) => {
  const t = String(v);
  const sur = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
  return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
};
const ligne = (...v: (string | number)[]) => v.map(cellule).join(";");
const euros = (cts: number) => (cts / 100).toFixed(2).replace(".", ",");
const jour = (d: string) => d.split("-").reverse().join("/");

export async function GET(request: Request) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  if (!accesMedical(utilisateur)) return new Response("Réservé aux médecins.", { status: 403 });

  const url = new URL(request.url);
  const p = url.searchParams.get("p") ?? "";
  const type = url.searchParams.get("type");
  if (!periodeValide(p) || (type !== "recettes" && type !== "charges")) return new Response("Demande invalide.", { status: 400 });
  const { du, au } = bornes(p);

  const lignes =
    type === "recettes"
      ? [
          ligne("Date", "Facture", "Patient", "Médecin", "Mode", "Référence", "Montant (MAD)"),
          ...(await paiementsDeLaPeriode(du, au)).map((l) =>
            ligne(jour(l.date), l.numero, l.patient, l.praticien, libelleMode(l.mode), l.reference, euros(l.montantCts)),
          ),
        ]
      : [
          ligne("Date", "Catégorie", "Libellé", "Fournisseur", "Mode", "À la charge de", "Montant (MAD)"),
          ...(await listerCharges(du, au)).map((c) =>
            ligne(jour(c.date), c.categorie, c.libelle, c.fournisseur, libelleMode(c.mode), c.praticienNom ?? "Cabinet (commun)", euros(c.montantCts)),
          ),
        ];

  await journaliser(utilisateur.identifiant, "export comptable", null, `${type} ${p}`);
  // BOM : Excel reconnaît l'UTF-8 (accents)
  return new Response(`\uFEFF${lignes.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type === "recettes" ? "livre-recettes" : "livre-depenses"}-${p}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

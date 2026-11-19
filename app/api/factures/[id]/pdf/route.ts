// Facture en PDF : secrétariat et médecins (la secrétaire encaisse et remet les factures)

import { utilisateurConnecte } from "../../../../agenda/session";
import { lireFacture } from "../../../../dossier/compta";
import { journaliser } from "../../../../dossier/journal";
import { lirePatient } from "../../../../dossier/patients";
import { pdfFacture } from "../../../../dossier/pdf";
import { reponsePdf } from "../../../../dossier/reponse-pdf";

export async function GET(_: Request, ctx: RouteContext<"/api/factures/[id]/pdf">) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return new Response("Session expirée : reconnectez-vous.", { status: 401 });
  const id = Number((await ctx.params).id);
  const trouvee = Number.isInteger(id) ? await lireFacture(id) : null;
  if (!trouvee) return new Response("Facture introuvable.", { status: 404 });
  const { facture, paiements } = trouvee;
  const patient = facture.patientId ? await lirePatient(facture.patientId) : null;
  await journaliser(utilisateur.identifiant, "facture imprimée", facture.patientId, facture.numero);
  const nom = `Facture ${facture.numero} ${facture.patientNom}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
  return reponsePdf(await pdfFacture(facture, paiements, patient), nom);
}

"use server";

import { exigerUtilisateur } from "../../../agenda/session";
import type { ReferenceSeuil } from "../../../dossier/comptes-rendus/seuils";
import { claudeConfigure } from "../../../dossier/dictee";
import { journaliser } from "../../../dossier/journal";
import { validerSeuil, verifierSeuil } from "../../../dossier/verification-seuils";

type Resultat = { reference: ReferenceSeuil } | { erreur: string };

// L'assistant cherche dans la bibliothèque et propose un verdict avec la phrase citée
export async function chercherReference(langue: string, id: string): Promise<Resultat> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  if (!claudeConfigure()) return { erreur: "Claude n'est pas configuré (clé ANTHROPIC_API_KEY)." };
  try {
    const reference = await verifierSeuil(id);
    await journaliser(utilisateur.identifiant, "seuil recherché dans la bibliothèque", null, `${id} : ${reference.verdict}`);
    return { reference };
  } catch (erreur) {
    console.error(erreur);
    return { erreur: "La recherche n'a pas pu aboutir. Réessayez dans un instant." };
  }
}

// Le médecin valide (après avoir lu le passage) ou demande une correction
export async function decider(
  langue: string,
  id: string,
  decision: ReferenceSeuil["valide"],
  commentaire: string,
): Promise<Resultat> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  if (!["", "conforme", "a_corriger"].includes(decision)) return { erreur: "Décision inconnue." };
  try {
    const reference = await validerSeuil(id, decision, utilisateur.identifiant, commentaire.trim().slice(0, 500));
    await journaliser(
      utilisateur.identifiant,
      decision ? `seuil ${decision === "conforme" ? "validé" : "à corriger"}` : "validation de seuil retirée",
      null,
      id,
    );
    return { reference };
  } catch (erreur) {
    console.error(erreur);
    return { erreur: "La décision n'a pas pu être enregistrée." };
  }
}

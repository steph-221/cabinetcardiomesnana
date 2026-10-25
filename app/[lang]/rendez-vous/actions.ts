"use server";

import { chevauche, creneauxDuJour, estJour, joursReservables } from "../../agenda/creneaux";
import { agendaConfigure, creerRendezvous, periodesOccupees } from "../../agenda/google";

// Créneaux encore libres pour un jour donné ("HH:MM")
export async function creneauxLibres(jour: string): Promise<string[] | null> {
  if (!agendaConfigure() || !estJour(jour) || !joursReservables().includes(jour)) return [];
  const creneaux = creneauxDuJour(jour);
  if (creneaux.length === 0) return [];
  try {
    const occupe = await periodesOccupees(creneaux[0].debut, creneaux[creneaux.length - 1].fin);
    return creneaux
      .filter((c) => !occupe.some((p) => chevauche(p, { debut: c.debut.getTime(), fin: c.fin.getTime() })))
      .map((c) => c.heure);
  } catch (erreur) {
    console.error(erreur);
    return null;
  }
}

export type EtatReservation =
  | { statut: "attente" }
  | {
      statut: "erreur";
      code: "champs" | "creneauPris" | "technique";
      // Valeurs saisies, pour que le formulaire ne se vide pas
      valeurs: { nom: string; telephone: string; motif: string };
    }
  | { statut: "confirme"; jour: string; heure: string };

const texte = (formData: FormData, champ: string, max: number) =>
  String(formData.get(champ) ?? "")
    .trim()
    .slice(0, max);

export async function reserver(_: EtatReservation, formData: FormData): Promise<EtatReservation> {
  const jour = texte(formData, "jour", 10);
  const heure = texte(formData, "heure", 5);
  const nom = texte(formData, "nom", 100);
  const telephone = texte(formData, "telephone", 30);
  const motif = texte(formData, "motif", 300);
  const erreur = (code: "champs" | "creneauPris" | "technique"): EtatReservation => ({
    statut: "erreur",
    code,
    valeurs: { nom, telephone, motif },
  });
  const telephoneValide = /^\+?[\d\s.-]{8,20}$/.test(telephone);
  // Champ invisible : seuls les robots le remplissent
  if (texte(formData, "site", 100)) return erreur("champs");
  if (!estJour(jour) || nom.length < 2 || !telephoneValide || formData.get("consentement") !== "on") {
    return erreur("champs");
  }
  if (!agendaConfigure()) return erreur("technique");

  // Revérifie juste avant d'enregistrer : le créneau a pu être pris entre-temps
  const creneau = joursReservables().includes(jour) ? creneauxDuJour(jour).find((c) => c.heure === heure) : undefined;
  if (!creneau) return erreur("creneauPris");

  try {
    const occupe = await periodesOccupees(creneau.debut, creneau.fin);
    if (occupe.some((p) => chevauche(p, { debut: creneau.debut.getTime(), fin: creneau.fin.getTime() }))) {
      return erreur("creneauPris");
    }
    await creerRendezvous({ debut: creneau.debut, fin: creneau.fin, nom, telephone, motif, source: "site" });
  } catch (e) {
    console.error(e);
    return erreur("technique");
  }
  return { statut: "confirme", jour, heure };
}

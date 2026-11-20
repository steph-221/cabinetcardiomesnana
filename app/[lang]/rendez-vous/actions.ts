"use server";

import { chevauche, creneauxDuJour, estJour, jourLocal, joursReservables } from "../../agenda/creneaux";
import { adresseIp, jetonValide, tropDeDemandes } from "../../agenda/antirobot";
import { compter } from "../../agenda/limite";
import { verifierTurnstile } from "../../agenda/turnstile";
import { agendaConfigure, creerRendezvous, periodesOccupees } from "../../agenda/google";

// Créneaux encore libres pour un jour donné ("HH:MM")
export async function creneauxLibres(jour: string): Promise<string[] | null> {
  if (!agendaConfigure() || !estJour(jour) || !joursReservables().includes(jour)) return [];
  const creneaux = creneauxDuJour(jour);
  if (creneaux.length === 0) return [];
  // Chaque appel interroge Google : 30 par minute et par adresse suffisent largement à un visiteur
  const essais = await compter(`creneaux:${await adresseIp()}`, 60);
  if (essais !== null && essais > 30) return null;
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
      code: "champs" | "creneauPris" | "technique" | "robot" | "limite";
      // Valeurs saisies, pour que le formulaire ne se vide pas
      valeurs: { prenom: string; nom: string; telephone: string; motif: string; dateNaissance: string; email: string };
    }
  | { statut: "confirme"; jour: string; heure: string };

const texte = (formData: FormData, champ: string, max: number) =>
  String(formData.get(champ) ?? "")
    .trim()
    .slice(0, max);

export async function reserver(_: EtatReservation, formData: FormData): Promise<EtatReservation> {
  const jour = texte(formData, "jour", 10);
  const heure = texte(formData, "heure", 5);
  const prenom = texte(formData, "prenom", 100);
  const nom = texte(formData, "nom", 100);
  const telephone = texte(formData, "telephone", 30);
  const motif = texte(formData, "motif", 300);
  // Facultatifs
  const dateNaissance = texte(formData, "dateNaissance", 10);
  const email = texte(formData, "email", 100);
  const erreur = (code: "champs" | "creneauPris" | "technique" | "robot" | "limite"): EtatReservation => ({
    statut: "erreur",
    code,
    valeurs: { prenom, nom, telephone, motif, dateNaissance, email },
  });
  const telephoneValide = /^\+?[\d\s.-]{8,20}$/.test(telephone);
  // Champ invisible : seuls les robots le remplissent
  if (texte(formData, "site", 100)) return erreur("champs");
  // Jeton signé émis à l'affichage de la page, et délai minimum de remplissage
  if (!jetonValide(texte(formData, "jeton", 100))) return erreur("robot");
  const naissanceValide =
    !dateNaissance || (estJour(dateNaissance) && dateNaissance >= "1900-01-01" && dateNaissance <= jourLocal(new Date()));
  const emailValide = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (
    !estJour(jour) ||
    nom.length < 2 ||
    prenom.length < 2 ||
    !telephoneValide ||
    !naissanceValide ||
    !emailValide ||
    formData.get("consentement") !== "on"
  ) {
    return erreur("champs");
  }
  if (!agendaConfigure()) return erreur("technique");
  const ip = await adresseIp();
  if (await tropDeDemandes(ip, telephone)) return erreur("limite");
  // Vérification Cloudflare Turnstile, si elle est activée (TURNSTILE_SECRET_KEY)
  if (!(await verifierTurnstile(texte(formData, "cf-turnstile-response", 4096), ip))) return erreur("robot");

  // Revérifie juste avant d'enregistrer : le créneau a pu être pris entre-temps
  const creneau = joursReservables().includes(jour) ? creneauxDuJour(jour).find((c) => c.heure === heure) : undefined;
  if (!creneau) return erreur("creneauPris");

  try {
    const occupe = await periodesOccupees(creneau.debut, creneau.fin);
    if (occupe.some((p) => chevauche(p, { debut: creneau.debut.getTime(), fin: creneau.fin.getTime() }))) {
      return erreur("creneauPris");
    }
    await creerRendezvous({
      debut: creneau.debut,
      fin: creneau.fin,
      nom,
      prenom,
      telephone,
      motif,
      dateNaissance,
      email,
      source: "site",
    });
  } catch (e) {
    console.error(e);
    return erreur("technique");
  }
  return { statut: "confirme", jour, heure };
}

"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { dateLocale, estJour, jourLocal } from "../../agenda/creneaux";
import { creerFermeture, creerRendezvous, rattacherRendezvous, supprimerRendezvous } from "../../agenda/google";
import { baseConfiguree } from "../../dossier/base";
import { journaliser } from "../../dossier/journal";
import { libellePatient, lirePatient } from "../../dossier/patients";
import { chercherPourRendezvous, completerIdentite, type DossierPropose } from "../../dossier/rendez-vous";
import {
  changerRole,
  enregistrerCompte,
  estAdmin,
  exigerUtilisateur,
  fermerSession,
  identifiantValide,
  ouvrirSession,
  supprimerCompte,
  verifierIdentifiants,
} from "../../agenda/session";
import { estRole } from "../../agenda/roles";
import { cabinet } from "../../cabinet";
import { echec, type EtatFormulaire } from "./formulaire";

export async function connexion(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const saisi = String(formData.get("identifiant") ?? "");
  const compte = await verifierIdentifiants(saisi, String(formData.get("motDePasse") ?? ""));
  if (!compte) {
    // Ralentit les essais de mots de passe à la chaîne
    await new Promise((r) => setTimeout(r, 1000));
    return { erreur: "Identifiant ou mot de passe incorrect.", valeurs: { identifiant: saisi } };
  }
  await ouvrirSession(compte);
  redirect(`/${langue}/espace`);
}

export async function deconnexion(langue: string) {
  await fermerSession();
  redirect(`/${langue}/espace/connexion`);
}

// Chaque action revérifie la session : ne jamais se fier à la page qui l'appelle
const exigerConnexion = (langue: string) => exigerUtilisateur(langue);

export async function annuler(langue: string, id: string) {
  await exigerConnexion(langue);
  await supprimerRendezvous(id);
  refresh();
}

export async function ajouter(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerConnexion(langue);
  const jour = String(formData.get("jour") ?? "");
  const heure = String(formData.get("heure") ?? "");
  const nom = String(formData.get("nom") ?? "").trim().slice(0, 100);
  const prenom = String(formData.get("prenom") ?? "").trim().slice(0, 100);
  const patientId = Number(formData.get("patientId")) || undefined;
  const telephone = String(formData.get("telephone") ?? "").trim().slice(0, 30);
  const motif = String(formData.get("motif") ?? "").trim().slice(0, 300);
  const dateNaissance = String(formData.get("dateNaissance") ?? "");
  const email = String(formData.get("email") ?? "").trim().slice(0, 100);
  const controle = formData.get("type") === "controle";
  const duree = Number(formData.get("duree")) || (controle ? cabinet.dureeControle : cabinet.dureeRdv);
  if (!estJour(jour) || !/^\d{2}:\d{2}$/.test(heure) || !nom || duree < 5 || duree > 240) {
    return echec("Merci de remplir la date, l'heure et le nom du patient.", formData);
  }
  if ((dateNaissance && !estJour(dateNaissance)) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return echec("Vérifiez la date de naissance et l'e-mail.", formData);
  }
  const debut = dateLocale(jour, heure);
  try {
    await creerRendezvous({
      debut,
      fin: new Date(debut.getTime() + duree * 60_000),
      nom,
      prenom,
      patientId,
      telephone,
      motif,
      dateNaissance,
      email,
      controle,
      source: "secretariat",
      par: utilisateur.identifiant,
    });
  } catch (erreur) {
    console.error(erreur);
    return echec("L'agenda Google n'a pas pu enregistrer le rendez-vous. Réessayez dans un instant.", formData);
  }
  refresh();
  return null;
}

// Recherche d'un dossier existant pour y rattacher un rendez-vous pris à la main
export async function chercherDossiers(langue: string, recherche: string): Promise<DossierPropose[]> {
  await exigerConnexion(langue);
  const q = recherche.trim().slice(0, 100);
  if (q.length < 2 || !baseConfiguree()) return [];
  try {
    return await chercherPourRendezvous(q);
  } catch (erreur) {
    console.error(erreur);
    return [];
  }
}

// Rattache un rendez-vous (souvent pris en ligne) à un dossier existant. Ce que le patient a déjà indiqué
// (date de naissance, e-mail, téléphone) complète le dossier uniquement là où il est vide.
export async function rattacher(langue: string, rdvId: string, patientId: number, formData: FormData) {
  const utilisateur = await exigerConnexion(langue);
  const patient = await lirePatient(patientId);
  if (!patient) return;
  const naissance = String(formData.get("naissance") ?? "");
  const email = String(formData.get("email") ?? "").trim().slice(0, 100);
  const telephone = String(formData.get("telephone") ?? "").trim().slice(0, 30);
  await completerIdentite(
    patientId,
    {
      naissance: estJour(naissance) && naissance >= "1900-01-01" && naissance <= jourLocal(new Date()) ? naissance : undefined,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      telephone: /^\+?[\d\s.-]{8,20}$/.test(telephone) ? telephone : undefined,
    },
    utilisateur.identifiant,
  );
  await rattacherRendezvous(rdvId, patientId);
  await journaliser(utilisateur.identifiant, "rendez-vous rattaché", patientId, libellePatient(patient));
  refresh();
}

// --- Comptes du personnel : réservé à l'administrateur ---

const exigerAdmin = (langue: string) => exigerUtilisateur(langue, "admin");

export async function enregistrer(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const admin = await exigerAdmin(langue);
  const identifiant = String(formData.get("identifiant") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!identifiantValide(identifiant) || estAdmin(identifiant)) {
    return echec("Identifiant invalide : 2 à 30 caractères, lettres minuscules, chiffres, point ou tiret.", formData);
  }
  if (motDePasse.length < 10) return echec("Le mot de passe doit faire au moins 10 caractères.", formData);
  if (!estRole(role)) return echec("Choisissez le rôle du compte.", formData);
  try {
    await enregistrerCompte(identifiant, motDePasse, admin.identifiant, role);
  } catch (erreur) {
    console.error(erreur);
    return echec("Le compte n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  refresh();
  return null;
}

export async function retirer(langue: string, identifiant: string) {
  await exigerAdmin(langue);
  await supprimerCompte(identifiant);
  refresh();
}

export async function modifierRole(langue: string, identifiant: string, formData: FormData) {
  await exigerAdmin(langue);
  const role = String(formData.get("role") ?? "");
  if (!estRole(role)) return;
  await changerRole(identifiant, role);
  refresh();
}

// --- Fermeture de créneaux : tout le personnel connecté ---

export async function fermer(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerConnexion(langue);
  const jourDebut = String(formData.get("jourDebut") ?? "");
  const jourFin = String(formData.get("jourFin") || jourDebut);
  const motif = String(formData.get("motif") ?? "").trim().slice(0, 100);
  if (!estJour(jourDebut) || !estJour(jourFin) || jourFin < jourDebut) {
    return echec("Vérifiez les dates : la date de fin doit être après la date de début.", formData);
  }

  let periode: Parameters<typeof creerFermeture>[0];
  if (formData.get("journeeEntiere") === "on") {
    periode = { jourDebut, jourFin };
  } else {
    const heureDebut = String(formData.get("heureDebut") ?? "");
    const heureFin = String(formData.get("heureFin") ?? "");
    if (!/^\d{2}:\d{2}$/.test(heureDebut) || !/^\d{2}:\d{2}$/.test(heureFin)) {
      return echec("Indiquez l'heure de début et l'heure de fin, ou cochez « Journée entière ».", formData);
    }
    periode = { debut: dateLocale(jourDebut, heureDebut), fin: dateLocale(jourFin, heureFin) };
    if (periode.fin <= periode.debut) return echec("L'heure de fin doit être après l'heure de début.", formData);
  }

  try {
    await creerFermeture(periode, motif, utilisateur.identifiant);
  } catch (erreur) {
    console.error(erreur);
    return echec("L'agenda Google n'a pas pu enregistrer la fermeture. Réessayez dans un instant.", formData);
  }
  refresh();
  return null;
}

export async function rouvrir(langue: string, id: string) {
  await exigerConnexion(langue);
  await supprimerRendezvous(id);
  refresh();
}

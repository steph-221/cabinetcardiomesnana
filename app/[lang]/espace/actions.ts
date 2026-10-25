"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { dateLocale, estJour } from "../../agenda/creneaux";
import { creerFermeture, creerRendezvous, supprimerRendezvous } from "../../agenda/google";
import {
  enregistrerCompte,
  estAdmin,
  fermerSession,
  identifiantValide,
  ouvrirSession,
  supprimerCompte,
  utilisateurConnecte,
  verifierIdentifiants,
} from "../../agenda/session";
import { cabinet } from "../../cabinet";

type EtatFormulaire = { erreur: string; valeurs: Record<string, string> } | null;

// Renvoie les valeurs saisies pour que le formulaire ne se vide pas en cas d'erreur
const echec = (erreur: string, formData: FormData): EtatFormulaire => ({
  erreur,
  valeurs: Object.fromEntries([...formData].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<
    string,
    string
  >,
});

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
async function exigerConnexion(langue: string) {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect(`/${langue}/espace/connexion`);
  return utilisateur;
}

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
  const telephone = String(formData.get("telephone") ?? "").trim().slice(0, 30);
  const motif = String(formData.get("motif") ?? "").trim().slice(0, 300);
  const duree = Number(formData.get("duree")) || cabinet.dureeRdv;
  if (!estJour(jour) || !/^\d{2}:\d{2}$/.test(heure) || !nom || duree < 5 || duree > 240) {
    return echec("Merci de remplir la date, l'heure et le nom du patient.", formData);
  }
  const debut = dateLocale(jour, heure);
  try {
    await creerRendezvous({
      debut,
      fin: new Date(debut.getTime() + duree * 60_000),
      nom,
      telephone,
      motif,
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

// --- Comptes du personnel : réservé à l'administrateur ---

async function exigerAdmin(langue: string) {
  const utilisateur = await exigerConnexion(langue);
  if (!utilisateur.admin) redirect(`/${langue}/espace`);
  return utilisateur;
}

export async function enregistrer(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const admin = await exigerAdmin(langue);
  const identifiant = String(formData.get("identifiant") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("motDePasse") ?? "");
  if (!identifiantValide(identifiant) || estAdmin(identifiant)) {
    return echec("Identifiant invalide : 2 à 30 caractères, lettres minuscules, chiffres, point ou tiret.", formData);
  }
  if (motDePasse.length < 10) return echec("Le mot de passe doit faire au moins 10 caractères.", formData);
  try {
    await enregistrerCompte(identifiant, motDePasse, admin.identifiant);
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

// --- Fermeture de créneaux : réservé à l'administrateur ---

export async function fermer(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const admin = await exigerAdmin(langue);
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
    await creerFermeture(periode, motif, admin.identifiant);
  } catch (erreur) {
    console.error(erreur);
    return echec("L'agenda Google n'a pas pu enregistrer la fermeture. Réessayez dans un instant.", formData);
  }
  refresh();
  return null;
}

export async function rouvrir(langue: string, id: string) {
  await exigerAdmin(langue);
  await supprimerRendezvous(id);
  refresh();
}

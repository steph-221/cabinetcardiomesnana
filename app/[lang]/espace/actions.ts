"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { dateLocale, estJour } from "../../agenda/creneaux";
import { creerRendezvous, supprimerRendezvous } from "../../agenda/google";
import { fermerSession, ouvrirSession, utilisateurConnecte, verifierIdentifiants } from "../../agenda/session";
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
  const identifiant = verifierIdentifiants(saisi, String(formData.get("motDePasse") ?? ""));
  if (!identifiant) {
    // Ralentit les essais de mots de passe à la chaîne
    await new Promise((r) => setTimeout(r, 1000));
    return { erreur: "Identifiant ou mot de passe incorrect.", valeurs: { identifiant: saisi } };
  }
  await ouvrirSession(identifiant);
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
      par: utilisateur,
    });
  } catch (erreur) {
    console.error(erreur);
    return echec("L'agenda Google n'a pas pu enregistrer le rendez-vous. Réessayez dans un instant.", formData);
  }
  refresh();
  return null;
}

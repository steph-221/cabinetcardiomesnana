"use server";

import { refresh } from "next/cache";
import { exigerUtilisateur } from "../../../../agenda/session";
import { estTypeSource } from "../../../../dossier/sources";
import { journaliser } from "../../../../dossier/journal";
import {
  creerSite,
  enregistrerAcces,
  lireMotDePasse,
  classerPublication,
  sitesARelire,
  supprimerSite,
  verifierSite,
  type NouveauSite,
} from "../../../../dossier/veille";
import { SITES_PROPOSES } from "../../../../dossier/sites-proposes";
import { echec, texte, type EtatFormulaire } from "../../formulaire";

const adresseValide = (url: string) => /^https:\/\/[^\s/]+\.[^\s]+$/.test(url);

export async function suivreSite(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const site: NouveauSite = {
    nom: texte(formData, "nom", 120),
    adresse: texte(formData, "adresse", 500),
    prefixe: texte(formData, "prefixe", 500),
    organisme: texte(formData, "organisme", 100),
    type: "recommandation",
    langue: formData.get("langueSource") === "fr" ? "fr" : "en",
  };
  const type = String(formData.get("type") ?? "");
  if (!estTypeSource(type) || type === "fiche") return echec("Choisissez le type de publications.", formData);
  site.type = type;
  if (!site.nom) return echec("Donnez un nom au site.", formData);
  if (!adresseValide(site.adresse)) return echec("L'adresse doit commencer par https://.", formData);
  if (site.prefixe && !adresseValide(site.prefixe)) {
    return echec("Le début des liens doit être une adresse complète, en https://.", formData);
  }
  return ajouter(site, utilisateur.identifiant, formData);
}

export async function suivreSitePropose(
  langue: string,
  cle: string,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const site = SITES_PROPOSES[cle];
  if (!site) return echec("Site inconnu.", formData);
  return ajouter(site, utilisateur.identifiant, formData);
}

async function ajouter(site: NouveauSite, par: string, formData: FormData): Promise<EtatFormulaire> {
  try {
    const id = await creerSite(site, par);
    await journaliser(par, "site suivi ajouté à la bibliothèque", null, site.nom);
    const resultat = await verifierSite(id);
    refresh();
    if ("erreur" in resultat) {
      return echec(`Site ajouté, mais sa liste n'a pas pu être lue : ${resultat.erreur}`, new FormData());
    }
    return null;
  } catch (erreur) {
    console.error(erreur);
    return echec("L'ajout a échoué. Réessayez dans un instant.", formData);
  }
}

export async function verifier(langue: string, id: number) {
  await exigerUtilisateur(langue, "medical");
  const resultat = await verifierSite(id);
  refresh();
  return resultat;
}

// File de lecture : « à lire » épingle la publication, « écartée » la masque, « » la remet à sa place
export async function classer(langue: string, id: number, etat: string) {
  await exigerUtilisateur(langue, "medical");
  await classerPublication(id, etat === "a_lire" || etat === "ecartee" ? etat : "");
  refresh();
}

export async function toutVerifier(langue: string) {
  await exigerUtilisateur(langue, "medical");
  for (const id of await sitesARelire()) await verifierSite(id);
  refresh();
}

export async function enregistrerAccesSite(
  langue: string,
  id: number,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const url = texte(formData, "accesUrl", 500);
  if (url && !adresseValide(url)) return echec("La page de connexion doit commencer par https://.", formData);
  // L'adresse d'une étape de connexion unique (« …?execution=e4s1 ») expire dès la fermeture de la page
  if (/[?&]execution=/i.test(url)) {
    return echec(
      "Cette adresse est une étape temporaire de connexion : elle ne fonctionnera plus demain. Indiquez plutôt la page d'accueil du site (https://www.escardio.org/) et connectez-vous depuis son bouton « Log in ».",
      formData,
    );
  }
  await enregistrerAcces(id, {
    url,
    identifiant: texte(formData, "identifiant", 200),
    motDePasse: String(formData.get("motDePasse") ?? "").slice(0, 200),
    effacer: formData.get("effacer") === "on",
  });
  await journaliser(utilisateur.identifiant, "accès abonné modifié", null, `site n° ${id}`);
  refresh();
  return null;
}

// Le mot de passe n'est envoyé au navigateur qu'à la demande, et chaque affichage est journalisé
export async function afficherMotDePasse(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const acces = await lireMotDePasse(id);
  if (!acces) return null;
  await journaliser(utilisateur.identifiant, "mot de passe d'accès abonné affiché", null, acces.nom);
  return acces.motDePasse;
}

export async function retirerSite(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await supprimerSite(id);
  await journaliser(utilisateur.identifiant, "site suivi retiré", null, `n° ${id}`);
  refresh();
}

"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { dateLocale, estJour, heureLocale, jourLocal } from "../../agenda/creneaux";
import {
  affecterMedecin,
  creerFermeture,
  creerRendezvous,
  lireRendezvous,
  modifierRendezvous,
  rattacherRendezvous,
  supprimerRendezvous,
} from "../../agenda/google";
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
  listerMedecins,
  ouvrirSession,
  supprimerCompte,
  verifierIdentifiants,
} from "../../agenda/session";
import { estRole } from "../../agenda/roles";
import { adresseIp } from "../../agenda/antirobot";
import { compter, effacer, lire, reserverUneFois } from "../../agenda/limite";
import { totpAdminActive, verifierTotp } from "../../agenda/totp";
import { cabinet } from "../../cabinet";
import { prevenirPatient } from "../../agenda/notification";
import { echec, texte, type EtatFormulaire, type EtatModification } from "./formulaire";

// Essais de connexion ratés tolérés par fenêtre de 15 minutes : par adresse, puis par identifiant (plus large,
// pour qu'on ne puisse pas bloquer facilement le compte d'une autre personne)
const FENETRE_CONNEXION = 15 * 60;
const ESSAIS_PAR_ADRESSE = 10;
const ESSAIS_PAR_IDENTIFIANT = 20;

async function tracerConnexion(action: string, identifiant: string, adresse: string) {
  if (!baseConfiguree()) return;
  // L'identifiant n'est conservé que s'il a la forme d'un identifiant : on y tape parfois son mot de passe par erreur
  const nom = identifiantValide(identifiant) ? identifiant : "(identifiant invalide)";
  await journaliser(nom, action, null, `adresse ${adresse}`).catch(console.error);
}

export async function connexion(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const saisi = String(formData.get("identifiant") ?? "");
  const identifiant = saisi.trim().toLowerCase();
  const adresse = await adresseIp();
  const refus = (erreur: string): EtatFormulaire => ({ erreur, valeurs: { identifiant: saisi } });

  if (
    (await lire(`connexion:ip:${adresse}`)) >= ESSAIS_PAR_ADRESSE ||
    (await lire(`connexion:id:${identifiant}`)) >= ESSAIS_PAR_IDENTIFIANT
  ) {
    await tracerConnexion("connexion verrouillée", identifiant, adresse);
    return refus("Trop d'essais. Réessayez dans 15 minutes.");
  }

  const compte = await verifierIdentifiants(saisi, String(formData.get("motDePasse") ?? ""));
  // Double authentification de l'administrateur, si elle est activée (TOTP_ADMIN)
  let valide = Boolean(compte);
  if (compte && estAdmin(compte.identifiant) && totpAdminActive()) {
    const pas = verifierTotp(process.env.TOTP_ADMIN!, String(formData.get("code") ?? ""));
    // Un code déjà utilisé est refusé : le voler à l'écran ne permet pas de le rejouer
    valide = pas !== null && (await reserverUneFois(`totp:${pas}`, 120));
  }

  if (!compte || !valide) {
    await Promise.all([
      compter(`connexion:ip:${adresse}`, FENETRE_CONNEXION),
      compter(`connexion:id:${identifiant}`, FENETRE_CONNEXION),
    ]);
    await tracerConnexion("connexion échouée", identifiant, adresse);
    // Ralentit les essais de mots de passe à la chaîne
    await new Promise((r) => setTimeout(r, 1000));
    // Même message dans tous les cas : on ne dit pas si c'est le mot de passe ou le code qui est bon
    return refus("Identifiant, mot de passe ou code de vérification incorrect.");
  }
  await effacer(`connexion:id:${identifiant}`);
  await ouvrirSession(compte);
  await tracerConnexion("connexion réussie", identifiant, adresse);
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

// Modifie un rendez-vous (de l'espace cabinet, du site ou ajouté directement dans Google Agenda).
// Si l'horaire change, le patient peut être prévenu par e-mail et WhatsApp : rendez-vous « annulé et remplacé ».
export async function modifier(
  langue: string,
  id: string,
  _: EtatModification,
  formData: FormData,
): Promise<EtatModification> {
  const utilisateur = await exigerConnexion(langue);
  const jour = String(formData.get("jour") ?? "");
  const heure = String(formData.get("heure") ?? "");
  const duree = Number(formData.get("duree"));
  const titre = texte(formData, "titre", 200);
  const nom = texte(formData, "nom", 100);
  const prenom = texte(formData, "prenom", 100);
  const telephone = texte(formData, "telephone", 30);
  const motif = texte(formData, "motif", 300);
  const email = texte(formData, "email", 100);
  const medecin = String(formData.get("medecin") ?? "");
  if (!estJour(jour) || !/^\d{2}:\d{2}$/.test(heure) || !nom || !(duree >= 5 && duree <= 240)) {
    return echec("Merci de remplir la date, l'heure, la durée et le nom du patient.", formData);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return echec("Vérifiez l'e-mail.", formData);
  if (medecin && !(await listerMedecins().catch((): string[] => [])).includes(medecin)) {
    return echec("Ce médecin n'existe pas (ou plus). Choisissez-en un autre.", formData);
  }

  let avant;
  try {
    avant = await lireRendezvous(id);
  } catch (erreur) {
    console.error(erreur);
    return echec("Ce rendez-vous est introuvable dans l'agenda Google (supprimé ?).", formData);
  }
  // Les fermetures et les événements « journée entière » ne sont pas des rendez-vous de patients
  if (avant.fermeture || avant.debut.length === 10) return echec("Cet événement ne peut pas être modifié ici.", formData);
  if (!avant.annulable && !titre) return echec("Indiquez le titre du rendez-vous.", formData);

  const debut = dateLocale(jour, heure);
  try {
    await modifierRendezvous(
      id,
      { debut, fin: new Date(debut.getTime() + duree * 60_000), titre, nom, prenom, telephone, email, motif, medecin },
      utilisateur.identifiant,
    );
  } catch (erreur) {
    console.error(erreur);
    return echec("L'agenda Google n'a pas pu enregistrer la modification. Réessayez dans un instant.", formData);
  }

  const ancienDebut = new Date(avant.debut);
  const horaireChange = ancienDebut.getTime() !== debut.getTime();
  if (baseConfiguree()) {
    await journaliser(
      utilisateur.identifiant,
      "rendez-vous modifié",
      avant.patientId ?? null,
      horaireChange ? `${avant.titre} : ${jourLocal(ancienDebut)} ${heureLocale(ancienDebut)} → ${jour} ${heure}` : avant.titre,
    ).catch(console.error);
  }

  // Le patient n'est prévenu que si la date ou l'heure change
  const notification = horaireChange
    ? await prevenirPatient(
        { prenom, nom, avant: ancienDebut, apres: debut, medecin: medecin || undefined },
        { email, telephone },
        { email: formData.get("prevenirEmail") === "on", whatsapp: formData.get("prevenirWhatsapp") === "on" },
      )
    : null;
  refresh();
  return { ok: true, notification };
}

// Rattache (ou détache) après coup un rendez-vous à un médecin, par exemple une réservation faite en ligne
export async function affecter(langue: string, id: string, formData: FormData) {
  await exigerConnexion(langue);
  const medecin = String(formData.get("medecin") ?? "");
  if (medecin && !(await listerMedecins().catch((): string[] => [])).includes(medecin)) return;
  await affecterMedecin(id, medecin);
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
  const medecin = String(formData.get("medecin") ?? "");
  const controle = formData.get("type") === "controle";
  const duree = Number(formData.get("duree")) || (controle ? cabinet.dureeControle : cabinet.dureeRdv);
  if (!estJour(jour) || !/^\d{2}:\d{2}$/.test(heure) || !nom || duree < 5 || duree > 240) {
    return echec("Merci de remplir la date, l'heure et le nom du patient.", formData);
  }
  if ((dateNaissance && !estJour(dateNaissance)) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return echec("Vérifiez la date de naissance et l'e-mail.", formData);
  }
  if (medecin && !(await listerMedecins().catch((): string[] => [])).includes(medecin)) {
    return echec("Ce médecin n'existe pas (ou plus). Choisissez-en un autre.", formData);
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
      medecin,
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

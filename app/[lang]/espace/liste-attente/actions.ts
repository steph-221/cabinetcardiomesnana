"use server";

import { refresh } from "next/cache";
import { numeroInternational } from "../../../agenda/identite";
import { quand } from "../../../agenda/notification";
import { messageCreneauLibere } from "../../../agenda/rappel";
import { exigerUtilisateur } from "../../../agenda/session";
import { journaliser } from "../../../dossier/journal";
import { ajouterAttente, classerAttente, listerAttente, listerCreneauxLibres, marquerPrevenu, traiterCreneau } from "../../../dossier/liste-attente";
import { echec, texte, type EtatFormulaire } from "../formulaire";

export async function ajouter(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue);
  const nom = texte(formData, "nom", 100);
  const telephone = texte(formData, "telephone", 30);
  const email = texte(formData, "email", 100);
  if (!nom) return echec("Indiquez le nom du patient.", formData);
  if (!telephone && !email) return echec("Indiquez un téléphone ou une adresse e-mail pour pouvoir le prévenir.", formData);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return echec("Vérifiez l'adresse e-mail.", formData);
  await ajouterAttente({ nom, prenom: texte(formData, "prenom", 100), telephone, email, souhait: texte(formData, "souhait", 300) }, utilisateur.identifiant);
  await journaliser(utilisateur.identifiant, "patient ajouté à la liste d'attente", null, nom);
  refresh();
  return null;
}

export async function classer(langue: string, id: number, statut: "place" | "retire") {
  const utilisateur = await exigerUtilisateur(langue);
  await classerAttente(id, statut === "place" ? "place" : "retire");
  await journaliser(utilisateur.identifiant, statut === "place" ? "patient de la liste d'attente placé" : "patient retiré de la liste d'attente", null, `n° ${id}`);
  refresh();
}

export async function creneauTraite(langue: string, id: number) {
  await exigerUtilisateur(langue);
  await traiterCreneau(id);
  refresh();
}

export type Prevenance = { whatsapp?: string; email?: string } | { erreur: string };

// Prépare le message « un créneau s'est libéré » pour ce patient, avec les prochains créneaux libérés, et le marque
// comme prévenu. Rien ne part tout seul : le secrétariat ouvre le lien et envoie.
export async function preparerPrevenance(langue: string, id: number): Promise<Prevenance> {
  const utilisateur = await exigerUtilisateur(langue);
  const attente = (await listerAttente()).find((a) => a.id === id);
  if (!attente) return { erreur: "Ce patient n'est plus sur la liste." };
  const creneaux = (await listerCreneauxLibres()).map((c) => `${quand(c.debut)}${c.medecin ? ` (Dr ${c.medecin})` : ""}`);
  const { sujet, texte: corps } = messageCreneauLibere(attente, creneaux);
  const numero = attente.telephone ? numeroInternational(attente.telephone) : null;
  const liens: { whatsapp?: string; email?: string } = {};
  if (numero) liens.whatsapp = `https://wa.me/${numero}?text=${encodeURIComponent(corps)}`;
  if (attente.email) liens.email = `mailto:${attente.email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  if (!liens.whatsapp && !liens.email) return { erreur: "Numéro ou adresse invalide : appelez le patient." };
  await marquerPrevenu(id);
  await journaliser(utilisateur.identifiant, "patient de la liste d'attente prévenu", null, `n° ${id}`);
  refresh();
  return liens;
}

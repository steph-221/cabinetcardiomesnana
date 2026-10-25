"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { estJour, jourLocal } from "../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../agenda/session";
import { journaliser } from "../../../dossier/journal";
import {
  ajouterTraitement,
  arreterTraitement,
  creerPatient,
  doublonsPossibles,
  facteursRisque,
  libellePatient,
  modifierPatient,
  supprimerPatient,
  supprimerTraitement,
  type ContenuMedical,
  type Identite,
} from "../../../dossier/patients";
import { echec, texte, type EtatFormulaire } from "../formulaire";

export type EtatPatient = (NonNullable<EtatFormulaire> & { doublons?: { id: number; libelle: string }[] }) | null;

// Les cases cochées des facteurs de risque sont regroupées pour être recochées après une erreur
function echecPatient(erreur: string, formData: FormData, doublons?: { id: number; libelle: string }[]): EtatPatient {
  const etat = echec(erreur, formData)!;
  etat.valeurs.facteursRisque = formData.getAll("facteursRisque").join("|");
  return { ...etat, doublons };
}

export async function enregistrerPatient(
  langue: string,
  id: number | null,
  _: EtatPatient,
  formData: FormData,
): Promise<EtatPatient> {
  const utilisateur = await exigerUtilisateur(langue);
  const sexe = String(formData.get("sexe") ?? "");
  const naissance = String(formData.get("naissance") ?? "");
  const identite: Identite = {
    nom: texte(formData, "nom", 100),
    prenom: texte(formData, "prenom", 100),
    sexe: sexe === "F" || sexe === "M" ? sexe : "",
    naissance: naissance || null,
    telephone: texte(formData, "telephone", 30),
    email: texte(formData, "email", 100),
    cin: texte(formData, "cin", 20).toUpperCase(),
    adresse: texte(formData, "adresse", 300),
    couverture: texte(formData, "couverture", 100),
    medecinTraitant: texte(formData, "medecinTraitant", 100),
  };
  if (!identite.nom) return echecPatient("Le nom du patient est obligatoire.", formData);
  if (naissance && (!estJour(naissance) || naissance < "1900-01-01" || naissance > jourLocal(new Date()))) {
    return echecPatient("Vérifiez la date de naissance.", formData);
  }
  if (identite.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identite.email)) {
    return echecPatient("Vérifiez l'adresse e-mail.", formData);
  }

  // La secrétaire ne voit pas le contenu médical : il n'est ni lu ni modifié pour elle
  const medical: ContenuMedical | null = accesMedical(utilisateur)
    ? {
        facteursRisque: formData
          .getAll("facteursRisque")
          .map(String)
          .filter((f) => (facteursRisque as readonly string[]).includes(f)),
        antecedents: texte(formData, "antecedents", 5000),
        allergies: texte(formData, "allergies", 1000),
        notes: texte(formData, "notes", 5000),
      }
    : null;

  let patientId = id;
  try {
    if (patientId === null) {
      if (formData.get("confirmerDoublon") !== "on") {
        const doublons = await doublonsPossibles(identite);
        if (doublons.length) {
          return echecPatient(
            "Un dossier semblable existe déjà (même téléphone, ou même nom et date de naissance). Ouvrez-le, ou cochez « Créer quand même ».",
            formData,
            doublons.map((d) => ({ id: d.id, libelle: libellePatient(d) })),
          );
        }
      }
      patientId = await creerPatient(identite, medical, utilisateur.identifiant);
      await journaliser(utilisateur.identifiant, "création", patientId, libellePatient(identite));
    } else {
      await modifierPatient(patientId, identite, medical, utilisateur.identifiant);
      await journaliser(utilisateur.identifiant, "modification", patientId, medical ? "" : "identité seulement");
    }
  } catch (erreur) {
    console.error(erreur);
    return echecPatient("Le dossier n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/patients/${patientId}`);
}

export async function supprimer(langue: string, id: number) {
  const admin = await exigerUtilisateur(langue, "admin");
  await supprimerPatient(id);
  await journaliser(admin.identifiant, "suppression", id);
  redirect(`/${langue}/espace/patients`);
}

// --- Traitements : médecins seulement ---

export async function nouveauTraitement(
  langue: string,
  patientId: number,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const medicament = texte(formData, "medicament", 150);
  const posologie = texte(formData, "posologie", 300);
  const debut = String(formData.get("debut") ?? "");
  if (!medicament) return echec("Indiquez le médicament.", formData);
  if (debut && !estJour(debut)) return echec("Vérifiez la date de début.", formData);
  try {
    await ajouterTraitement(patientId, { medicament, posologie, debut: debut || null }, utilisateur.identifiant);
    await journaliser(utilisateur.identifiant, "traitement ajouté", patientId, `${medicament} ${posologie}`.trim());
  } catch (erreur) {
    console.error(erreur);
    return echec("Le traitement n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  refresh();
  return null;
}

export async function arreter(langue: string, patientId: number, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await arreterTraitement(patientId, id, jourLocal(new Date()), utilisateur.identifiant);
  await journaliser(utilisateur.identifiant, "traitement arrêté", patientId);
  refresh();
}

export async function effacerTraitement(langue: string, patientId: number, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await supprimerTraitement(patientId, id);
  await journaliser(utilisateur.identifiant, "traitement supprimé", patientId);
  refresh();
}

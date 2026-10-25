"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { estJour, jourLocal } from "../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur } from "../../../agenda/session";
import {
  bornesConstantes,
  enregistrerConsultation,
  mesures,
  supprimerConsultation,
  type Constantes,
  type SaisieConsultation,
} from "../../../dossier/consultations";
import { mettreALaCorbeille } from "../../../dossier/drive";
import { modifierConclusion, supprimerExamen } from "../../../dossier/examens";
import { journaliser } from "../../../dossier/journal";
import {
  ajouterTraitement,
  arreterTraitement,
  creerPatient,
  doublonsPossibles,
  facteursRisque,
  libellePatient,
  lirePatient,
  modifierPatient,
  supprimerPatient,
  supprimerTraitement,
  type ContenuMedical,
  type Identite,
} from "../../../dossier/patients";
import { echec, texte, type EtatFormulaire } from "../formulaire";

// Nombre saisi avec virgule ou point : null si vide, undefined si illisible
function decimalSaisi(formData: FormData, nom: string) {
  const brut = String(formData.get(nom) ?? "").trim().replace(",", ".");
  if (!brut) return null;
  const n = Number(brut);
  return Number.isFinite(n) ? n : undefined;
}

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

  // Zone cible de l'INR : les deux bornes, ou aucune
  const inrMin = decimalSaisi(formData, "inrMin");
  const inrMax = decimalSaisi(formData, "inrMax");
  if (accesMedical(utilisateur)) {
    const invalide = (v: number | null | undefined) => v === undefined || (v !== null && (v < 1 || v > 6));
    if (invalide(inrMin) || invalide(inrMax) || (inrMin === null) !== (inrMax === null) || (inrMin ?? 0) >= (inrMax ?? 1)) {
      return echecPatient("Zone cible de l'INR : indiquez un minimum et un maximum entre 1 et 6 (par exemple 2,5 et 3,5).", formData);
    }
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
        inrMin: inrMin ?? null,
        inrMax: inrMax ?? null,
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
  const patient = await lirePatient(id);
  await supprimerPatient(id);
  // Le dossier Drive part à la corbeille (récupérable 30 jours)
  if (patient?.driveDossier) await mettreALaCorbeille(patient.driveDossier).catch(console.error);
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

// --- Examens : la conclusion et la suppression sont réservées aux médecins ---

export async function changerConclusion(langue: string, patientId: number, id: number, formData: FormData) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await modifierConclusion(patientId, id, texte(formData, "conclusion", 5000));
  await journaliser(utilisateur.identifiant, "conclusion d'examen modifiée", patientId);
  refresh();
}

export async function retirerExamen(langue: string, patientId: number, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const fichier = await supprimerExamen(patientId, id);
  if (fichier) await mettreALaCorbeille(fichier).catch(console.error);
  await journaliser(utilisateur.identifiant, "examen supprimé", patientId);
  refresh();
}

// --- Consultations : médecins seulement ---

export async function enregistrerConsultationPatient(
  langue: string,
  patientId: number,
  id: number | null,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const date = String(formData.get("date") ?? "");
  if (!estJour(date) || date > jourLocal(new Date())) return echec("Vérifiez la date de la consultation.", formData);

  const constantes = {} as Constantes;
  for (const [cle, [min, max]] of Object.entries(bornesConstantes) as [keyof Constantes, [number, number]][]) {
    const v = decimalSaisi(formData, cle);
    if (v === undefined || (v !== null && (v < min || v > max))) {
      return echec(`Valeur invalide pour ${libellesConstantes[cle]} (entre ${min} et ${max}).`, formData);
    }
    constantes[cle] = v === null ? null : cle === "poids" ? Math.round(v * 10) / 10 : Math.round(v);
  }
  const valeurs: SaisieConsultation["mesures"] = {};
  for (const m of mesures) {
    const v = decimalSaisi(formData, m.cle);
    if (v === undefined || (v !== null && (v < m.min || v > m.max))) {
      return echec(`Valeur invalide pour ${m.libelle} (entre ${m.min} et ${m.max} ${m.unite}).`, formData);
    }
    if (v !== null) valeurs[m.cle] = v;
  }

  let enregistre: number | null;
  try {
    enregistre = await enregistrerConsultation(
      patientId,
      id,
      {
        date,
        ...constantes,
        motif: texte(formData, "motif", 1000),
        examen: texte(formData, "examen", 5000),
        ecg: texte(formData, "ecg", 2000),
        mesures: valeurs,
        autres: texte(formData, "autres", 2000),
        conclusion: texte(formData, "conclusion", 5000),
        conduite: texte(formData, "conduite", 5000),
      },
      utilisateur.identifiant,
    );
    await journaliser(utilisateur.identifiant, id ? "consultation modifiée" : "consultation ajoutée", patientId, date);
  } catch (erreur) {
    console.error(erreur);
    return echec("La consultation n'a pas pu être enregistrée. Réessayez dans un instant.", formData);
  }
  if (enregistre === null) return echec("Cette consultation n'existe plus.", formData);
  redirect(`/${langue}/espace/patients/${patientId}#consultations`);
}

const libellesConstantes: Record<keyof Constantes, string> = {
  taSys: "la TA systolique",
  taDia: "la TA diastolique",
  fc: "la FC",
  spo2: "la SpO₂",
  poids: "le poids",
  taille: "la taille",
};

export async function retirerConsultation(langue: string, patientId: number, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await supprimerConsultation(patientId, id);
  await journaliser(utilisateur.identifiant, "consultation supprimée", patientId);
  redirect(`/${langue}/espace/patients/${patientId}#consultations`);
}

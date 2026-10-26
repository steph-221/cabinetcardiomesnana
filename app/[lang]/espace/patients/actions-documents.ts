"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { estJour, jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import { cabinet } from "../../../cabinet";
import { compteDrive, envoyerExamen, mettreALaCorbeille } from "../../../dossier/drive";
import { champsETT, type DonneesETT } from "../../../dossier/ett";
import { ajouterExamen, rangerFichierExamen } from "../../../dossier/examens";
import { journaliser } from "../../../dossier/journal";
import {
  creerOrdonnance,
  rangerOrdonnance,
  supprimerOrdonnance,
  type LigneOrdonnance,
} from "../../../dossier/ordonnances";
import { lirePatient, type Patient } from "../../../dossier/patients";
import { pdfETT, pdfOrdonnance } from "../../../dossier/pdf";
import { nomFichier } from "../../../dossier/reponse-pdf";
import { echec, texte, type EtatFormulaire } from "../formulaire";

// Copie du PDF dans le dossier Drive du patient, si Drive est connecté. Un échec n'empêche pas d'imprimer.
async function archiver(patient: Patient, nom: string, contenu: Buffer) {
  try {
    if (!(await compteDrive())) return null;
    const drive = await envoyerExamen(patient, nom, new Blob([new Uint8Array(contenu)], { type: "application/pdf" }));
    return { drive, nom, taille: contenu.length };
  } catch (erreur) {
    console.error(erreur);
    return null;
  }
}

const decimal = (brut: FormDataEntryValue | null) => {
  const t = String(brut ?? "")
    .trim()
    .replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

// --- Ordonnance ---

export async function nouvelleOrdonnance(
  langue: string,
  patientId: number,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const patient = await lirePatient(patientId);
  if (!patient) return echec("Dossier introuvable.", formData);

  // Lignes du formulaire : médicaments, posologies et durées, dans l'ordre
  const medicaments = formData.getAll("medicament").map((v) => String(v).trim().slice(0, 150));
  const posologies = formData.getAll("posologie").map((v) => String(v).trim().slice(0, 300));
  const durees = formData.getAll("duree").map((v) => String(v).trim().slice(0, 50));
  const lignes: LigneOrdonnance[] = medicaments
    .map((medicament, i) => ({ medicament, posologie: posologies[i] ?? "", duree: durees[i] ?? "" }))
    .filter((l) => l.medicament);
  if (!lignes.length) return echec("Ajoutez au moins un médicament.", formData);
  if (lignes.length > 20) return echec("20 lignes au plus par ordonnance.", formData);
  const ordonnance = { date: jourLocal(new Date()), lignes, remarque: texte(formData, "remarque", 2000) };

  try {
    const id = await creerOrdonnance(patientId, ordonnance, utilisateur.identifiant);
    await journaliser(utilisateur.identifiant, "ordonnance rédigée", patientId, `${lignes.length} ligne(s)`);
    const copie = await archiver(
      patient,
      nomFichier("Ordonnance", patient, ordonnance.date),
      await pdfOrdonnance(ordonnance, patient),
    );
    if (copie) await rangerOrdonnance(id, copie.drive);
  } catch (erreur) {
    console.error(erreur);
    return echec("L'ordonnance n'a pas pu être enregistrée. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/patients/${patientId}#ordonnances`);
}

export async function retirerOrdonnance(langue: string, patientId: number, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const fichier = await supprimerOrdonnance(patientId, id);
  if (fichier) await mettreALaCorbeille(fichier).catch(console.error);
  await journaliser(utilisateur.identifiant, "ordonnance supprimée", patientId);
  refresh();
}

// --- Compte rendu d'ETT ---

export async function nouveauCompteRenduETT(
  langue: string,
  patientId: number,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const patient = await lirePatient(patientId);
  if (!patient) return echec("Dossier introuvable.", formData);
  const date = String(formData.get("date") ?? "");
  if (!estJour(date) || date > jourLocal(new Date())) return echec("Vérifiez la date de l'examen.", formData);

  const valeurs: DonneesETT["valeurs"] = {};
  for (const champ of champsETT) {
    const brut = formData.get(champ.cle);
    if (champ.texte) {
      const t = String(brut ?? "")
        .trim()
        .slice(0, 300);
      if (t) valeurs[champ.cle] = t;
      continue;
    }
    const n = decimal(brut);
    if (
      n === undefined ||
      (n !== null && ((champ.min !== undefined && n < champ.min) || (champ.max !== undefined && n > champ.max)))
    ) {
      return echec(
        `Valeur invalide pour « ${champ.libelle} » (entre ${champ.min} et ${champ.max}${champ.unite ? ` ${champ.unite}` : ""}).`,
        formData,
      );
    }
    if (n !== null) valeurs[champ.cle] = n;
  }
  valeurs.methodeFevg = texte(formData, "methodeFevg", 30) || "SBP";
  const poids = decimal(formData.get("poids"));
  const taille = decimal(formData.get("taille"));
  if (
    poids === undefined ||
    taille === undefined ||
    (poids !== null && (poids < 1 || poids > 400)) ||
    (taille !== null && (taille < 30 || taille > 250))
  ) {
    return echec("Vérifiez le poids et la taille.", formData);
  }
  const donnees: DonneesETT = {
    indication: texte(formData, "indication", 300),
    operateur: texte(formData, "operateur", 100) || cabinet.medecin,
    poids,
    taille,
    valeurs,
    total: texte(formData, "total", 5000),
  };
  if (!donnees.total) return echec("Rédigez le « AU TOTAL » (les propositions peuvent y être ajoutées).", formData);

  try {
    const id = await ajouterExamen(
      patientId,
      { type: "Échocardiographie (ETT)", date, conclusion: donnees.total, valeurs: { ett: donnees }, fichier: null },
      utilisateur.identifiant,
    );
    await journaliser(utilisateur.identifiant, "compte rendu d'ETT rédigé", patientId, date);
    const copie = await archiver(patient, nomFichier("ETT", patient, date), await pdfETT(donnees, date, patient));
    if (copie) await rangerFichierExamen(id, copie);
  } catch (erreur) {
    console.error(erreur);
    return echec("Le compte rendu n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/patients/${patientId}#examens`);
}

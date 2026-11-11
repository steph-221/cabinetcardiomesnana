"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { estJour, jourLocal } from "../../../agenda/creneaux";
import { accesMedical, exigerUtilisateur, utilisateurConnecte } from "../../../agenda/session";
import { cabinet } from "../../../cabinet";
import { lireChoixConsultation } from "../../../dossier/choix-consultation";
import { compteDrive, envoyerExamen, mettreALaCorbeille } from "../../../dossier/drive";
import { champsETT, type DonneesETT } from "../../../dossier/ett";
import { ajouterExamen, rangerFichierExamen, typesExamen } from "../../../dossier/examens";
import { journaliser } from "../../../dossier/journal";
import { composer, detecterSituations, type Suggestion } from "../../../dossier/aide-prescription";
import { produitsParSubstance } from "../../../dossier/aide-prescription-produits";
import { allergieConcernee } from "../../../dossier/cardio-medicaments";
import { lireConsultation } from "../../../dossier/consultations";
import { chercherMedicaments, type MedicamentMa } from "../../../dossier/medicaments-ma";
import {
  creerOrdonnance,
  rangerOrdonnance,
  supprimerOrdonnance,
  type LigneOrdonnance,
} from "../../../dossier/ordonnances";
import { age as ageAu, lirePatient, listerTraitements, type Patient } from "../../../dossier/patients";
import { champs, type DonneesExamen, type ValeursExamen } from "../../../dossier/comptes-rendus/types";
import { trouverModele } from "../../../dossier/comptes-rendus";
import { referencesCitees } from "../../../dossier/comptes-rendus/references";
import { trouverSeuil } from "../../../dossier/comptes-rendus/seuils";
import { lireReferences } from "../../../dossier/verification-seuils";
import { pdfCertificat, pdfCompteRendu, pdfETT, pdfOrdonnance } from "../../../dossier/pdf";
import { analysesValides } from "../../../dossier/analyses-biologie";
import { trouverModeleCertificat } from "../../../dossier/certificats-modeles";
import { creerCertificat, rangerCertificat, supprimerCertificat } from "../../../dossier/certificats";
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

// Références citées par les repères [1], [2]… du « AU TOTAL » : retrouvées côté serveur d'après les règles choisies
async function lignesReferences(total: string, brut: FormDataEntryValue | null) {
  const demandees = String(brut ?? "").split(",").filter(Boolean).slice(0, 20);
  const ids = demandees.filter((id) => trouverSeuil(id));
  if (!ids.length || ids.length !== demandees.length) return [];
  const refs = await lireReferences().catch(() => ({}));
  return referencesCitees(total, ids, refs).map((l) => l.slice(0, 900));
}

// --- Ordonnance ---

// Aide à la prescription (information seulement) : situations repérées dans la consultation choisie, avec les
// familles, substances, posologies usuelles et produits (liens medicament.ma) à envisager
export async function aidePrescription(patientId: number, consultationId: number | null): Promise<Suggestion[] | null> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur || !accesMedical(utilisateur) || !Number.isInteger(patientId)) return null;
  const patient = await lirePatient(patientId);
  if (!patient) return null;
  const consultation = consultationId ? await lireConsultation(patientId, consultationId) : null;
  const traitements = (await listerTraitements(patientId)).filter((t) => !t.fin).map((t) => t.medicament);
  const rubriques = [
    { source: "motif", texte: consultation?.motif ?? "" },
    { source: "examen", texte: consultation?.examen ?? "" },
    { source: "ECG", texte: consultation?.ecg ?? "" },
    { source: "autres examens", texte: consultation?.autres ?? "" },
    { source: "conclusion", texte: consultation?.conclusion ?? "" },
    { source: "conduite", texte: consultation?.conduite ?? "" },
    { source: "antécédents", texte: `${patient.antecedents} ${patient.facteursRisque.join(" ")}` },
  ].filter((r) => r.texte.trim());
  const contexte = {
    rubriques,
    taSys: consultation?.taSys ?? null,
    taDia: consultation?.taDia ?? null,
    fc: consultation?.fc ?? null,
    fevg: consultation?.mesures.fevg ?? null,
    ldl: consultation?.mesures.ldl ?? null,
    allergies: patient.allergies,
    traitements,
  };
  return composer(detecterSituations(contexte), contexte, await produitsParSubstance(), allergieConcernee);
}

// Recherche dans la base publique medicament.ma (réservée aux comptes médicaux)
export async function rechercherMedicaments(saisie: string): Promise<MedicamentMa[]> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur || !accesMedical(utilisateur)) return [];
  return chercherMedicaments(String(saisie).slice(0, 80));
}

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
  // Lien de la fiche medicament.ma quand le médicament vient de la base de référence (sert aux alertes)
  const fiches = formData.getAll("fiche").map((v) => String(v).trim().slice(0, 300));
  const ficheValide = (u: string | undefined) => (u && /^https:\/\/medicament\.ma\/medicament\/[^\s]+$/.test(u) ? u : undefined);
  const lignes: LigneOrdonnance[] = medicaments
    .map((medicament, i) => ({
      medicament,
      posologie: posologies[i] ?? "",
      duree: durees[i] ?? "",
      ...(ficheValide(fiches[i]) ? { fiche: ficheValide(fiches[i]) } : {}),
    }))
    .filter((l) => l.medicament);
  if (!lignes.length) return echec("Ajoutez au moins un médicament.", formData);
  if (lignes.length > 20) return echec("20 lignes au plus par ordonnance.", formData);
  const ordonnance = {
    date: jourLocal(new Date()),
    lignes,
    remarque: texte(formData, "remarque", 2000),
    consultationId: lireChoixConsultation(formData.get("consultationId")),
  };

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
  redirect(`/${langue}/espace/patients/${patientId}?onglet=documents`);
}

export async function retirerOrdonnance(langue: string, patientId: number, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const fichier = await supprimerOrdonnance(patientId, id);
  if (fichier) await mettreALaCorbeille(fichier).catch(console.error);
  await journaliser(utilisateur.identifiant, "ordonnance supprimée", patientId);
  refresh();
}

// --- Prescription d'analyses biologiques (ordonnance de type « biologie ») ---

export async function nouvellePrescriptionBiologie(
  langue: string,
  patientId: number,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const patient = await lirePatient(patientId);
  if (!patient) return echec("Dossier introuvable.", formData);
  const analyses = analysesValides(formData.getAll("analyse").map(String));
  const autres = texte(formData, "remarque", 2000);
  if (!analyses.length && !autres) return echec("Cochez au moins une analyse ou notez-en une dans « Autres analyses ».", formData);
  const prescription = {
    date: jourLocal(new Date()),
    lignes: analyses.map((medicament) => ({ medicament, posologie: "", duree: "" })),
    remarque: autres,
    consultationId: lireChoixConsultation(formData.get("consultationId")),
    type: "biologie" as const,
  };
  try {
    const id = await creerOrdonnance(patientId, prescription, utilisateur.identifiant);
    await journaliser(utilisateur.identifiant, "prescription d'analyses rédigée", patientId, `${analyses.length} analyse(s)`);
    const copie = await archiver(
      patient,
      nomFichier("Prescription analyses", patient, prescription.date),
      await pdfOrdonnance(prescription, patient),
    );
    if (copie) await rangerOrdonnance(id, copie.drive);
  } catch (erreur) {
    console.error(erreur);
    return echec("La prescription n'a pas pu être enregistrée. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/patients/${patientId}?onglet=documents`);
}

// --- Certificat médical ---

export async function nouveauCertificat(
  langue: string,
  patientId: number,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const patient = await lirePatient(patientId);
  if (!patient) return echec("Dossier introuvable.", formData);
  const modele = trouverModeleCertificat(String(formData.get("modele") ?? ""));
  if (!modele) return echec("Choisissez un modèle de certificat.", formData);
  // Le texte validé est celui que le médecin a relu (et éventuellement retouché) à l'écran
  const contenu = texte(formData, "texte", 5000);
  if (contenu.length < 20) return echec("Le texte du certificat est vide.", formData);
  const champsSaisis = Object.fromEntries(
    modele.champs.map((c) => [c.cle, texte(formData, `champ_${c.cle}`, 1000)]),
  );
  const certificat = {
    date: jourLocal(new Date()),
    modele: modele.cle,
    champs: champsSaisis,
    texte: contenu,
    consultationId: lireChoixConsultation(formData.get("consultationId")),
  };
  try {
    const id = await creerCertificat(patientId, certificat, utilisateur.identifiant);
    await journaliser(utilisateur.identifiant, "certificat rédigé", patientId, modele.libelle);
    const format = formData.get("format") === "A4" ? "A4" : "A5";
    const copie = await archiver(
      patient,
      nomFichier("Certificat", patient, certificat.date),
      await pdfCertificat(certificat, patient, format),
    );
    if (copie) await rangerCertificat(id, copie.drive);
  } catch (erreur) {
    console.error(erreur);
    return echec("Le certificat n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/patients/${patientId}?onglet=documents`);
}

export async function retirerCertificat(langue: string, patientId: number, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const fichier = await supprimerCertificat(patientId, id);
  if (fichier) await mettreALaCorbeille(fichier).catch(console.error);
  await journaliser(utilisateur.identifiant, "certificat supprimé", patientId);
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
  donnees.references = await lignesReferences(donnees.total, formData.get("references"));

  try {
    const id = await ajouterExamen(
      patientId,
      {
        type: "Échocardiographie (ETT)",
        date,
        conclusion: donnees.total,
        valeurs: { ett: donnees },
        fichier: null,
        consultationId: lireChoixConsultation(formData.get("consultationId")),
      },
      utilisateur.identifiant,
    );
    await journaliser(utilisateur.identifiant, "compte rendu d'ETT rédigé", patientId, date);
    const copie = await archiver(patient, nomFichier("ETT", patient, date), await pdfETT(donnees, date, patient));
    if (copie) await rangerFichierExamen(id, copie);
  } catch (erreur) {
    console.error(erreur);
    return echec("Le compte rendu n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/patients/${patientId}?onglet=examens`);
}

// --- Compte rendu rédigé par Claude à partir d'une dictée, relu et corrigé par le médecin ---

export async function enregistrerCompteRendu(
  langue: string,
  patientId: number,
  type: string,
  date: string,
  compteRendu: string,
  // Choix de la consultation : vide = automatique, « aucune », ou son numéro
  consultation = "",
): Promise<string | null> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  if (!typesExamen.includes(type)) return "Type d'examen inconnu.";
  if (!estJour(date) || date > jourLocal(new Date())) return "Vérifiez la date de l'examen.";
  const corps = compteRendu.trim().slice(0, 20_000);
  if (!corps) return "Le compte rendu est vide.";
  if (!(await lirePatient(patientId))) return "Dossier introuvable.";
  try {
    await ajouterExamen(
      patientId,
      {
        type,
        date,
        conclusion: corps,
        valeurs: { redaction: true },
        fichier: null,
        consultationId: lireChoixConsultation(consultation),
      },
      utilisateur.identifiant,
    );
    await journaliser(utilisateur.identifiant, "compte rendu enregistré", patientId, `${type} ${date}`);
  } catch (erreur) {
    console.error(erreur);
    return "Le compte rendu n'a pas pu être enregistré. Réessayez dans un instant.";
  }
  redirect(`/${langue}/espace/patients/${patientId}?onglet=examens`);
}

// --- Compte rendu d'ECG, de MAPA ou d'épreuve d'effort (champs, calculs et propositions : dossier/comptes-rendus) ---

export async function nouveauCompteRenduExamen(
  langue: string,
  patientId: number,
  cle: string,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const modele = trouverModele(cle);
  if (!modele) return echec("Modèle de compte rendu inconnu.", formData);
  const patient = await lirePatient(patientId);
  if (!patient) return echec("Dossier introuvable.", formData);
  const date = String(formData.get("date") ?? "");
  if (!estJour(date) || date > jourLocal(new Date())) return echec("Vérifiez la date de l'examen.", formData);

  const valeurs: ValeursExamen = {};
  for (const champ of champs(modele)) {
    const brut = String(formData.get(champ.cle) ?? "").trim();
    if (!brut) continue;
    if (champ.type === "nombre") {
      const n = Number(brut.replace(",", "."));
      if (!Number.isFinite(n) || (champ.min !== undefined && n < champ.min) || (champ.max !== undefined && n > champ.max)) {
        return echec(
          `Valeur invalide pour « ${champ.libelle} » (entre ${champ.min} et ${champ.max}${champ.unite ? ` ${champ.unite}` : ""}).`,
          formData,
        );
      }
      valeurs[champ.cle] = n;
    } else if (champ.type === "choix") {
      if (!champ.options?.includes(brut)) return echec(`Choix invalide pour « ${champ.libelle} ».`, formData);
      valeurs[champ.cle] = brut;
    } else valeurs[champ.cle] = brut.slice(0, 300);
  }
  const donnees: DonneesExamen = {
    modele: modele.cle,
    indication: texte(formData, "indication", 300),
    operateur: texte(formData, "operateur", 100) || cabinet.medecin,
    age: ageAu(patient.naissance, date),
    sexe: patient.sexe,
    valeurs,
    total: texte(formData, "total", 5000),
  };
  if (!donnees.total) return echec("Rédigez le « AU TOTAL » (les propositions peuvent y être ajoutées).", formData);
  donnees.references = await lignesReferences(donnees.total, formData.get("references"));

  try {
    const id = await ajouterExamen(
      patientId,
      {
        type: modele.type,
        date,
        conclusion: donnees.total,
        valeurs: { cr: donnees },
        fichier: null,
        consultationId: lireChoixConsultation(formData.get("consultationId")),
      },
      utilisateur.identifiant,
    );
    await journaliser(utilisateur.identifiant, `compte rendu ${modele.bouton} rédigé`, patientId, date);
    const copie = await archiver(patient, nomFichier(modele.bouton, patient, date), await pdfCompteRendu(donnees, date, patient));
    if (copie) await rangerFichierExamen(id, copie);
  } catch (erreur) {
    console.error(erreur);
    return echec("Le compte rendu n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/patients/${patientId}?onglet=examens`);
}

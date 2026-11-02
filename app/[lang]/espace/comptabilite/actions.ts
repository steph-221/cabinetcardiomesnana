"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { estJour, jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import {
  ajouterPaiement,
  annulerFacture,
  creerCharge,
  creerFacture,
  enregistrerActe,
  enregistrerPraticien,
  lireFacture,
  listerPraticiens,
  reglerMiseEnCommun,
  supprimerActe,
  supprimerCharge,
  supprimerPaiement,
} from "../../../dossier/compta";
import {
  categoriesCharges,
  estMode,
  lireMontant,
  mad,
  totalFacture,
  totalLignes,
  type LigneFacture,
  type ModePaiement,
} from "../../../dossier/compta-calculs";
import { journaliser } from "../../../dossier/journal";
import { lirePatient, libellePatient } from "../../../dossier/patients";
import { echec, texte, type EtatFormulaire } from "../formulaire";

// Une date saisie doit exister vraiment (pas le 31 février)
const jourReel = (v: string) => estJour(v) && new Date(`${v}T12:00:00Z`).toISOString().startsWith(v);
const aujourdhui = () => jourLocal(new Date());

// --- Factures ---

export async function nouvelleFacture(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue);

  const date = texte(formData, "date", 10);
  if (!jourReel(date)) return echec("Date de facture invalide.", formData);
  if (date > aujourdhui()) return echec("La date de la facture ne peut pas être dans le futur.", formData);

  const praticienId = Number(formData.get("praticien"));
  const praticiens = await listerPraticiens();
  if (!praticiens.some((p) => p.id === praticienId && p.actif)) return echec("Choisissez le médecin.", formData);

  // Lignes : désignation, quantité, prix unitaire, dans l'ordre
  const libelles = formData.getAll("libelle").map((v) => String(v).trim().slice(0, 150));
  const quantites = formData.getAll("quantite").map((v) => Number(String(v).replace(",", ".")));
  const prix = formData.getAll("prix").map((v) => lireMontant(String(v)));
  const lignes: LigneFacture[] = [];
  for (const [i, libelle] of libelles.entries()) {
    if (!libelle && !String(formData.getAll("prix")[i] ?? "").trim()) continue; // ligne laissée vide
    const quantite = quantites[i];
    if (!libelle) return echec(`Ligne ${i + 1} : indiquez la désignation.`, formData);
    if (!Number.isInteger(quantite * 100) || quantite <= 0 || quantite > 999)
      return echec(`Ligne ${i + 1} : quantité invalide.`, formData);
    if (prix[i] === null || prix[i] === undefined) return echec(`Ligne ${i + 1} : prix invalide.`, formData);
    lignes.push({ libelle, quantite, prixCts: prix[i] });
  }
  if (!lignes.length) return echec("Ajoutez au moins une ligne.", formData);
  if (lignes.length > 30) return echec("30 lignes au plus par facture.", formData);

  const remiseSaisie = texte(formData, "remise", 12);
  const remiseCts = remiseSaisie ? lireMontant(remiseSaisie) : 0;
  if (remiseCts === null) return echec("Remise invalide.", formData);
  if (remiseCts > totalLignes(lignes)) return echec("La remise dépasse le total des lignes.", formData);
  const totalCts = totalFacture(lignes, remiseCts);

  // Patient : un dossier du cabinet, ou un nom saisi à la main
  const patientId = Number(formData.get("patient")) || null;
  let patientNom = texte(formData, "patient_nom", 120);
  if (patientId) {
    const patient = await lirePatient(patientId);
    if (!patient) return echec("Dossier introuvable.", formData);
    patientNom = libellePatient(patient);
  }
  if (!patientNom) return echec("Indiquez le nom du patient.", formData);

  // Encaissement immédiat (facultatif)
  const modeSaisi = texte(formData, "mode", 20);
  let reglement: { montantCts: number; mode: ModePaiement; reference: string } | null = null;
  if (modeSaisi && modeSaisi !== "aucun") {
    if (!estMode(modeSaisi)) return echec("Mode de paiement invalide.", formData);
    const montantCts = lireMontant(texte(formData, "encaisse", 12) || "0");
    if (montantCts === null) return echec("Montant encaissé invalide.", formData);
    if (montantCts > totalCts) return echec("Le montant encaissé dépasse le total de la facture.", formData);
    if (montantCts > 0) reglement = { montantCts, mode: modeSaisi, reference: texte(formData, "reference", 80) };
  }

  let resultat: { id: number; numero: string };
  try {
    resultat = await creerFacture(
      { date, patientId, patientNom, praticienId, lignes, remiseCts, totalCts, note: texte(formData, "note", 500) },
      reglement,
      utilisateur.identifiant,
    );
    await journaliser(
      utilisateur.identifiant,
      "facture créée",
      patientId,
      `${resultat.numero} — ${mad(totalCts)}${reglement ? ` (encaissé ${mad(reglement.montantCts)})` : ""}`,
    );
  } catch (erreur) {
    console.error(erreur);
    return echec("La facture n'a pas pu être enregistrée. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/comptabilite/factures/${resultat.id}`);
}

export async function nouveauPaiement(
  langue: string,
  factureId: number,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue);
  const trouvee = await lireFacture(factureId);
  if (!trouvee) return echec("Facture introuvable.", formData);
  const { facture } = trouvee;
  if (facture.annulee) return echec("Cette facture est annulée.", formData);

  const date = texte(formData, "date", 10);
  if (!jourReel(date) || date > aujourdhui()) return echec("Date de paiement invalide.", formData);
  if (date < facture.date) return echec("Le paiement ne peut pas précéder la facture.", formData);
  const mode = texte(formData, "mode", 20);
  if (!estMode(mode)) return echec("Choisissez le mode de paiement.", formData);
  const montantCts = lireMontant(texte(formData, "montant", 12));
  if (!montantCts) return echec("Montant invalide.", formData);
  const reste = facture.totalCts - facture.payeCts;
  if (montantCts > reste) return echec(`Le montant dépasse le reste à payer (${mad(reste)}).`, formData);

  try {
    await ajouterPaiement(factureId, { date, montantCts, mode, reference: texte(formData, "reference", 80) }, utilisateur.identifiant);
    await journaliser(utilisateur.identifiant, "paiement enregistré", facture.patientId, `${facture.numero} — ${mad(montantCts)}`);
  } catch (erreur) {
    console.error(erreur);
    return echec("Le paiement n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  refresh();
  return null;
}

// Corriger une erreur de saisie : médecins seulement, et tracé dans le journal
export async function retirerPaiement(langue: string, factureId: number, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const trouvee = await lireFacture(factureId);
  const montant = await supprimerPaiement(factureId, id);
  if (montant !== null && trouvee) {
    await journaliser(
      utilisateur.identifiant,
      "paiement supprimé",
      trouvee.facture.patientId,
      `${trouvee.facture.numero} — ${mad(montant)}`,
    );
  }
  refresh();
}

export async function annuler(langue: string, factureId: number, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const trouvee = await lireFacture(factureId);
  if (!trouvee) return echec("Facture introuvable.", formData);
  if (trouvee.facture.payeCts > 0)
    return echec("Cette facture a des paiements : supprimez-les d'abord (remboursement), puis annulez-la.", formData);
  const motif = texte(formData, "motif", 200);
  if (!motif) return echec("Indiquez le motif de l'annulation.", formData);
  await annulerFacture(factureId, motif, utilisateur.identifiant);
  await journaliser(utilisateur.identifiant, "facture annulée", trouvee.facture.patientId, `${trouvee.facture.numero} — ${motif}`);
  refresh();
  return null;
}

// --- Charges ---

export async function nouvelleCharge(langue: string, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const date = texte(formData, "date", 10);
  if (!jourReel(date)) return echec("Date invalide.", formData);
  const categorie = texte(formData, "categorie", 60);
  if (!(categoriesCharges as readonly string[]).includes(categorie)) return echec("Choisissez la catégorie.", formData);
  const libelle = texte(formData, "libelle", 150);
  if (!libelle) return echec("Indiquez le libellé de la dépense.", formData);
  const montantCts = lireMontant(texte(formData, "montant", 12));
  if (!montantCts) return echec("Montant invalide.", formData);
  const mode = texte(formData, "mode", 20);
  if (!estMode(mode)) return echec("Choisissez le mode de paiement.", formData);

  // « commune » = partagée entre les médecins ; sinon l'identifiant du médecin qui la supporte seul
  const imputation = texte(formData, "imputation", 10);
  let praticienId: number | null = null;
  if (imputation !== "commune") {
    praticienId = Number(imputation);
    if (!(await listerPraticiens()).some((p) => p.id === praticienId)) return echec("Choisissez qui supporte la charge.", formData);
  }

  try {
    await creerCharge(
      { date, categorie, libelle, fournisseur: texte(formData, "fournisseur", 120), montantCts, mode, praticienId },
      utilisateur.identifiant,
    );
    await journaliser(utilisateur.identifiant, "charge enregistrée", null, `${categorie} — ${libelle} — ${mad(montantCts)}`);
  } catch (erreur) {
    console.error(erreur);
    return echec("La charge n'a pas pu être enregistrée. Réessayez dans un instant.", formData);
  }
  refresh();
  return null;
}

export async function retirerCharge(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const charge = await supprimerCharge(id);
  if (charge) await journaliser(utilisateur.identifiant, "charge supprimée", null, `${charge.libelle} — ${mad(charge.montantCts)}`);
  refresh();
}

// --- Réglages : médecins associés, partage, tarifs ---

export async function reglerPraticien(langue: string, id: number | null, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const nom = texte(formData, "nom", 100);
  if (!nom) return echec("Indiquez le nom du médecin.", formData);
  const part = Number(texte(formData, "part", 3));
  if (!Number.isInteger(part) || part < 0 || part > 100) return echec("La part doit être un pourcentage entre 0 et 100.", formData);
  const compte = texte(formData, "compte", 30).toLowerCase() || null;
  await enregistrerPraticien({ id, nom, compte, part, actif: formData.get("actif") === "on" || id === null });
  await journaliser(utilisateur.identifiant, "médecin associé enregistré", null, `${nom} — ${part} %`);
  refresh();
  return null;
}

export async function reglerPartage(langue: string, miseEnCommun: boolean) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await reglerMiseEnCommun(miseEnCommun);
  await journaliser(utilisateur.identifiant, "mode de partage modifié", null, miseEnCommun ? "résultat mis en commun" : "honoraires individuels");
  refresh();
}

export async function reglerActe(langue: string, id: number | null, _: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  await exigerUtilisateur(langue, "medical");
  const libelle = texte(formData, "libelle", 150);
  if (!libelle) return echec("Indiquez le nom de l'acte.", formData);
  const tarifCts = lireMontant(texte(formData, "tarif", 12));
  if (tarifCts === null) return echec("Tarif invalide.", formData);
  await enregistrerActe({ id, libelle, tarifCts });
  refresh();
  return null;
}

export async function retirerActe(langue: string, id: number) {
  await exigerUtilisateur(langue, "medical");
  await supprimerActe(id);
  refresh();
}

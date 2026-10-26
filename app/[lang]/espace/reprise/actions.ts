"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import { cabinet } from "../../../cabinet";
import { enregistrerConsultation } from "../../../dossier/consultations";
import { claudeConfigure } from "../../../dossier/dictee";
import { champsETT, type DonneesETT } from "../../../dossier/ett";
import { ajouterExamen } from "../../../dossier/examens";
import {
  ajouterTraitementsRepris,
  cloreImport,
  enregistrerImport,
  extraire,
  importExistant,
  lierPatient,
  lireImport,
  propositionVide,
  rouvrirImport,
  supprimerImport,
} from "../../../dossier/import-word";
import { journaliser } from "../../../dossier/journal";
import { bornes, mesures } from "../../../dossier/mesures";
import {
  creerPatient,
  facteursRisque,
  lirePatient,
  modifierPatient,
  supprimerPatient,
} from "../../../dossier/patients";
import { identiteLocale, masquer } from "../../../dossier/reprise";
import { echec, texte, type EtatFormulaire } from "../formulaire";

// Un fichier Word, déjà lu dans le navigateur : identité repérée ici, contenu médical extrait par Claude
export async function analyserFichier(
  langue: string,
  nomFichier: string,
  contenu: string,
): Promise<{ id: number; deja: boolean } | { erreur: string }> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const nom = String(nomFichier ?? "").slice(0, 200);
  const brut = String(contenu ?? "").slice(0, 200_000);
  if (brut.trim().length < 30) return { erreur: "Le document est vide." };
  const deja = await importExistant(nom, brut);
  if (deja) return { id: deja, deja: true };

  const identite = identiteLocale(brut, nom);
  let proposition = propositionVide(identite);
  if (claudeConfigure()) {
    try {
      proposition = await extraire(masquer(brut, identite));
    } catch (erreur) {
      console.error(erreur);
      proposition.aVerifier = [
        "La lecture automatique a échoué : remplissez le dossier d'après le texte, ou réessayez.",
      ];
    }
  }
  const id = await enregistrerImport({ nomFichier: nom, texte: brut, identite, proposition }, utilisateur.identifiant);
  await journaliser(utilisateur.identifiant, "compte rendu Word lu", null, nom);
  return { id, deja: false };
}

export async function ignorerImport(langue: string, id: number) {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  await cloreImport(id, "ignore", null, utilisateur.identifiant);
  refresh();
}

export async function retirerImport(langue: string, id: number) {
  await exigerUtilisateur(langue, "medical");
  await supprimerImport(id);
  refresh();
}

const nombre = (formData: FormData, nom: string) => {
  const t = String(formData.get(nom) ?? "")
    .trim()
    .replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const jour = (formData: FormData, nom: string) => {
  const d = String(formData.get(nom) ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

// Validation par le médecin : création du dossier (ou ajout à un dossier existant), traitements, visites et ETT
export async function validerImport(
  langue: string,
  id: number,
  _: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const imp = await lireImport(id);
  if (!imp || imp.statut !== "a_valider") return echec("Ce compte rendu a déjà été traité.", formData);
  const aujourdhui = jourLocal(new Date());
  const dateValide = (d: string | null) => d !== null && d >= "1950-01-01" && d <= aujourdhui;

  // Visites
  const visites = [];
  const nbVisites = Number(formData.get("nbVisites")) || 0;
  for (let i = 0; i < Math.min(nbVisites, 100); i++) {
    if (formData.get(`v${i}_garder`) !== "on") continue;
    const date = jour(formData, `v${i}_date`);
    if (!dateValide(date)) return echec(`Visite ${i + 1} : indiquez une date valide (ou décochez-la).`, formData);
    const v = {
      date: date!,
      motif: texte(formData, `v${i}_motif`, 2000),
      examen: texte(formData, `v${i}_examen`, 5000),
      ecg: texte(formData, `v${i}_ecg`, 2000),
      autres: texte(formData, `v${i}_autres`, 5000),
      conclusion: texte(formData, `v${i}_conclusion`, 5000),
      conduite: texte(formData, `v${i}_conduite`, 5000),
      taSys: null as number | null,
      taDia: null as number | null,
      fc: null as number | null,
      spo2: null as number | null,
      poids: null as number | null,
      taille: null as number | null,
      mesures: {} as Record<string, number>,
    };
    for (const c of ["taSys", "taDia", "fc", "spo2", "poids", "taille"] as const) {
      const n = nombre(formData, `v${i}_${c}`);
      if (n === undefined || (n !== null && (n < bornes[c][0] || n > bornes[c][1]))) {
        return echec(`Visite ${i + 1} : valeur invraisemblable (${c}).`, formData);
      }
      v[c] = n;
    }
    for (const m of mesures) {
      const n = nombre(formData, `v${i}_${m.cle}`);
      if (n === undefined || (n !== null && (n < m.min || n > m.max))) {
        return echec(`Visite ${i + 1} : valeur invraisemblable (${m.libelle}).`, formData);
      }
      if (n !== null) v.mesures[m.cle] = n;
    }
    visites.push(v);
  }

  // ETT
  let ett: { date: string; donnees: DonneesETT } | null = null;
  if (formData.get("ett_garder") === "on") {
    const date = jour(formData, "ett_date");
    if (!dateValide(date)) return echec("ETT : indiquez une date valide (ou décochez-la).", formData);
    const valeurs: DonneesETT["valeurs"] = { methodeFevg: "SBP" };
    for (const c of champsETT) {
      if (c.texte) {
        const t = texte(formData, `ett_${c.cle}`, 300);
        if (t) valeurs[c.cle] = t;
        continue;
      }
      const n = nombre(formData, `ett_${c.cle}`);
      if (
        n === undefined ||
        (n !== null && ((c.min !== undefined && n < c.min) || (c.max !== undefined && n > c.max)))
      ) {
        return echec(`ETT : valeur invalide pour « ${c.libelle} ».`, formData);
      }
      if (n !== null) valeurs[c.cle] = n;
    }
    const total = texte(formData, "ett_total", 5000);
    if (!total) return echec("ETT : le « AU TOTAL » est vide.", formData);
    ett = {
      date: date!,
      donnees: {
        indication: texte(formData, "ett_indication", 300),
        operateur: texte(formData, "ett_operateur", 100) || cabinet.medecin,
        poids: null,
        taille: null,
        valeurs,
        total,
      },
    };
  }

  // Traitements
  const derniere = [...visites.map((v) => v.date), ett?.date ?? ""].sort().at(-1) || aujourdhui;
  const traitements = [];
  const nbTraitements = Number(formData.get("nbTraitements")) || 0;
  for (let i = 0; i < Math.min(nbTraitements, 40); i++) {
    if (formData.get(`t${i}_garder`) !== "on") continue;
    const medicament = texte(formData, `t${i}_medicament`, 150);
    if (!medicament) continue;
    traitements.push({
      medicament,
      posologie: texte(formData, `t${i}_posologie`, 300),
      fin: formData.get(`t${i}_arrete`) === "on" ? derniere : null,
    });
  }

  // Contenu médical
  const medical = {
    facteursRisque: facteursRisque.filter((_, i) => formData.get(`fdr_${i}`) === "on"),
    antecedents: texte(formData, "antecedents", 5000),
    allergies: texte(formData, "allergies", 1000),
    notes: "",
    inrMin: nombre(formData, "inrMin") ?? null,
    inrMax: nombre(formData, "inrMax") ?? null,
  };
  if ((medical.inrMin === null) !== (medical.inrMax === null) || (medical.inrMin ?? 0) > (medical.inrMax ?? 0)) {
    return echec("Zone cible d'INR : indiquez le minimum et le maximum.", formData);
  }

  const cible = String(formData.get("cible") ?? "nouveau");
  const existant = cible === "nouveau" ? null : await lirePatient(Number(cible));
  if (cible !== "nouveau" && !existant) return echec("Le dossier choisi n'existe plus.", formData);
  const identite = {
    nom: texte(formData, "nom", 100),
    prenom: texte(formData, "prenom", 100),
    sexe: (["F", "M"].includes(String(formData.get("sexe"))) ? formData.get("sexe") : "") as "" | "F" | "M",
    naissance: jour(formData, "naissance"),
    telephone: texte(formData, "telephone", 30),
    email: "",
    cin: "",
    adresse: "",
    couverture: "",
    medecinTraitant: "",
  };
  if (!existant && (!identite.nom || !identite.prenom)) return echec("Indiquez le nom et le prénom.", formData);
  if (identite.naissance && !dateValide(identite.naissance) && identite.naissance > "1900-01-01") {
    return echec("Vérifiez la date de naissance.", formData);
  }
  if (!visites.length && !ett && !traitements.length && !existant) {
    return echec("Rien à importer : cochez au moins une visite, l'ETT ou un traitement.", formData);
  }

  // Le compte rendu est réservé avant l'écriture, pour qu'un double envoi ne l'importe pas deux fois
  if (!(await cloreImport(id, "importe", null, utilisateur.identifiant))) {
    return echec("Ce compte rendu a déjà été traité.", formData);
  }
  let patientId = 0;
  let cree = false;
  try {
    if (existant) {
      patientId = existant.id;
      // Le dossier existant est complété sans rien effacer
      const ajout = (actuel: string, nouveau: string) =>
        !nouveau || actuel.includes(nouveau) ? actuel : [actuel, nouveau].filter(Boolean).join("\n");
      await modifierPatient(
        patientId,
        existant,
        {
          facteursRisque: [...new Set([...existant.facteursRisque, ...medical.facteursRisque])],
          antecedents: ajout(existant.antecedents, medical.antecedents),
          allergies: ajout(existant.allergies, medical.allergies),
          notes: existant.notes,
          inrMin: existant.inrMin ?? medical.inrMin,
          inrMax: existant.inrMax ?? medical.inrMax,
        },
        utilisateur.identifiant,
      );
    } else {
      patientId = await creerPatient(identite, medical, utilisateur.identifiant);
      cree = true;
    }
    await ajouterTraitementsRepris(patientId, traitements, utilisateur.identifiant);
    for (const v of visites) await enregistrerConsultation(patientId, null, v, utilisateur.identifiant);
    if (ett) {
      await ajouterExamen(
        patientId,
        {
          type: "Échocardiographie (ETT)",
          date: ett.date,
          conclusion: ett.donnees.total,
          valeurs: { ett: ett.donnees },
          fichier: null,
        },
        utilisateur.identifiant,
      );
    }
    await lierPatient(id, patientId);
    await journaliser(
      utilisateur.identifiant,
      "reprise d'un compte rendu Word",
      patientId,
      `${imp.nomFichier} : ${visites.length} visite(s)${ett ? ", 1 ETT" : ""}, ${traitements.length} traitement(s)`,
    );
  } catch (erreur) {
    console.error(erreur);
    // Un dossier créé à moitié est retiré, pour que la nouvelle tentative ne fasse pas de doublon
    if (cree) await supprimerPatient(patientId).catch(console.error);
    await rouvrirImport(id).catch(console.error);
    return echec("L'import n'a pas pu être enregistré. Réessayez dans un instant.", formData);
  }
  redirect(`/${langue}/espace/patients/${patientId}`);
}

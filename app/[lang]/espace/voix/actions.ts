"use server";

import { refresh } from "next/cache";
import { jourLocal } from "../../../agenda/creneaux";
import { exigerUtilisateur } from "../../../agenda/session";
import { journaliser } from "../../../dossier/journal";
import { normaliserActions, trouverTraitement } from "../../../dossier/note-vocale";
import {
  ajouterNote,
  ajouterTraitement,
  arreterTraitement,
  libellePatient,
  lirePatient,
  listerTraitements,
} from "../../../dossier/patients";
import { ajouterSuivi } from "../../../dossier/suivis";

// Patient de la page ouverte, pour l'afficher dans la note vocale
export async function patientDeLaNote(langue: string, id: number) {
  await exigerUtilisateur(langue, "medical");
  if (!Number.isInteger(id) || id <= 0) return null;
  const patient = await lirePatient(id);
  return patient ? { id: patient.id, libelle: libellePatient(patient) } : null;
}

export type BilanNote = { faits: string[]; echecs: string[] };

// Applique les actions relues et validées par le médecin. Une ordonnance n'est pas créée ici : elle s'ouvre
// préremplie dans son formulaire, où le médecin la complète et l'enregistre.
export async function appliquerNote(langue: string, patientId: number, brut: unknown): Promise<BilanNote> {
  const utilisateur = await exigerUtilisateur(langue, "medical");
  const bilan: BilanNote = { faits: [], echecs: [] };
  const patient = Number.isInteger(patientId) && patientId > 0 ? await lirePatient(patientId) : null;
  if (!patient) return { faits: [], echecs: ["Dossier introuvable."] };
  const aujourdhui = jourLocal(new Date());
  const jour = (d: string) => d.split("-").reverse().join("/");
  const par = utilisateur.identifiant;

  for (const a of normaliserActions(brut, aujourdhui)) {
    try {
      if (a.type === "note") {
        const ok = await ajouterNote(patientId, `[${jour(aujourdhui)}] ${a.texte}`, par);
        if (ok) bilan.faits.push("Note ajoutée au dossier.");
        else bilan.echecs.push("Note non ajoutée : les notes du dossier sont pleines.");
      } else if (a.type === "suivi") {
        if (!a.echeance) bilan.echecs.push(`Suivi « ${a.quoi} » : indiquez l'échéance.`);
        else {
          await ajouterSuivi(patientId, a.quoi, a.echeance, par);
          bilan.faits.push(`Suivi prévu : ${a.quoi}, vers le ${jour(a.echeance)}.`);
        }
      } else if (a.type === "traitement") {
        await ajouterTraitement(patientId, { medicament: a.medicament, posologie: a.posologie, debut: aujourdhui }, par);
        bilan.faits.push(`Traitement ajouté : ${[a.medicament, a.posologie].filter(Boolean).join(", ")}.`);
      } else if (a.type === "arret") {
        const traitement = trouverTraitement(await listerTraitements(patientId), a.medicament);
        if (!traitement) {
          bilan.echecs.push(`« ${a.medicament} » : aucun traitement en cours, ou plusieurs, à ce nom. Arrêtez-le depuis le dossier.`);
        } else {
          await arreterTraitement(patientId, traitement.id, aujourdhui, par);
          bilan.faits.push(`Traitement arrêté : ${traitement.medicament}.`);
        }
      }
    } catch (erreur) {
      console.error(erreur);
      bilan.echecs.push("Une action n'a pas pu être enregistrée. Réessayez.");
    }
  }
  if (bilan.faits.length) {
    await journaliser(par, "note vocale enregistrée", patientId, `${bilan.faits.length} action(s)`);
    refresh();
  }
  return bilan;
}

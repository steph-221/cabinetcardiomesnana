// Secrétariat automatique, chaque après-midi : rappelle les rendez-vous du lendemain et relance par e-mail les suivis
// dus. N'envoie que ce qui part vraiment tout seul (e-mail via Resend, WhatsApp si son modèle de rappel est approuvé) ;
// le reste attend la secrétaire sur la page Rappels et dans Suivis. Appelée par vercel.json avec CRON_SECRET.

import { ajouterJours, dateLocale, jourLocal } from "../../../agenda/creneaux";
import { listerRendezvous, marquerRendezvous } from "../../../agenda/google";
import { lienRdv } from "../../../agenda/lien-patient";
import { emailConfigure, envoyerEmail, rappelerPatient } from "../../../agenda/notification";
import { sujetRelance, texteRelance } from "../../../agenda/rappel";
import { baseConfiguree } from "../../../dossier/base";
import { journaliser } from "../../../dossier/journal";
import { changerStatut, suivisARelancerParEmail } from "../../../dossier/suivis";
import { secretTacheValide } from "../autorisation";

export const maxDuration = 120;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ erreur: "Tâche planifiée non activée (CRON_SECRET)." }, { status: 503 });
  if (!secretTacheValide(request)) return Response.json({ erreur: "Accès refusé." }, { status: 401 });

  const debut = Date.now();
  const bilan = { rappels: 0, rappelsEchoues: 0, relances: 0, relancesEchouees: 0 };
  const demain = ajouterJours(jourLocal(new Date()), 1);
  try {
    // 1. Rappels de la veille : seuls les rendez-vous patients pas encore confirmés ni rappelés
    const rdvs = (await listerRendezvous(dateLocale(demain, "00:00"), dateLocale(ajouterJours(demain, 1), "00:00"))).filter(
      (r) => !r.fermeture && r.debut.length > 10 && r.annulable && !r.confirme && !r.rappelLe && (r.email || r.telephone),
    );
    for (const r of rdvs.slice(0, 80)) {
      if (Date.now() - debut > 90_000) break;
      const resultat = await rappelerPatient(
        { prenom: r.prenom, nom: r.nom, debut: new Date(r.debut), medecin: r.medecin, lien: lienRdv(r.id) },
        { email: r.email, telephone: r.telephone },
      );
      if (resultat.email.statut === "envoye" || resultat.whatsapp.statut === "envoye") {
        await marquerRendezvous(r.id, { rappelLe: new Date().toISOString() });
        bilan.rappels++;
      } else bilan.rappelsEchoues++;
    }

    // 2. Relances de suivi par e-mail (patients avec adresse, suivi dû et jamais relancé)
    if (baseConfiguree() && emailConfigure()) {
      for (const s of await suivisARelancerParEmail(jourLocal(new Date()))) {
        if (Date.now() - debut > 110_000) break;
        try {
          await envoyerEmail(s.email!, sujetRelance(s.quoi), texteRelance(s));
          await changerStatut(s.patientId, s.id, "relance", "relance automatique");
          await journaliser("relance automatique", "suivi relancé par e-mail", s.patientId, s.quoi);
          bilan.relances++;
        } catch (erreur) {
          console.error(erreur);
          bilan.relancesEchouees++;
        }
      }
    }
    if (baseConfiguree()) {
      await journaliser("secrétariat automatique", "rappels et relances", null, JSON.stringify(bilan)).catch(console.error);
    }
    return Response.json(bilan);
  } catch (erreur) {
    console.error(erreur);
    return Response.json({ erreur: "La tâche a échoué.", ...bilan }, { status: 500 });
  }
}

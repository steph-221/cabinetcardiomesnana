// Horaires encore libres pour chaque jour réservable, en un seul appel à l'agenda.

import { chevauche, creneauxDuJour, joursReservables, type Jour } from "./creneaux";
import { periodesOccupees } from "./google";

export type JourLibre = { jour: Jour; creneaux: string[] }; // creneaux vide = jour complet

export async function disponibilites(maintenant = new Date()): Promise<JourLibre[] | null> {
  const parJour = joursReservables(maintenant).map((jour) => ({ jour, creneaux: creneauxDuJour(jour, maintenant) }));
  const tous = parJour.flatMap((j) => j.creneaux);
  if (tous.length === 0) return parJour.map(({ jour }) => ({ jour, creneaux: [] }));
  try {
    const occupe = await periodesOccupees(tous[0].debut, tous[tous.length - 1].fin);
    return parJour.map(({ jour, creneaux }) => ({
      jour,
      creneaux: creneaux
        .filter((c) => !occupe.some((p) => chevauche(p, { debut: c.debut.getTime(), fin: c.fin.getTime() })))
        .map((c) => c.heure),
    }));
  } catch (erreur) {
    console.error(erreur);
    return null;
  }
}

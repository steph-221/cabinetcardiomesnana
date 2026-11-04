import { describe, expect, it, vi, beforeEach } from "vitest";

const occupe = vi.fn();
vi.mock("./google", () => ({ periodesOccupees: (...args: unknown[]) => occupe(...args) }));

import { disponibilites } from "./disponibilites";
import { dateLocale, jourLocal } from "./creneaux";

// Mardi 3 nov. 2026, 10:00 à Casablanca (UTC+1) : le jour même a encore des horaires
const maintenant = new Date("2026-11-03T09:00:00Z");

describe("disponibilites", () => {
  beforeEach(() => occupe.mockReset());

  it("retire les créneaux occupés et garde les jours libres", async () => {
    // 09:00 – 09:30 occupé le jour même
    occupe.mockResolvedValue([{ debut: dateLocale(jourLocal(maintenant), "09:00").getTime() - 1, fin: dateLocale(jourLocal(maintenant), "09:30").getTime() }]);
    const dispos = await disponibilites(maintenant);
    expect(dispos?.[0].jour).toBe("2026-11-03");
    expect(dispos?.[0].creneaux).not.toContain("09:00");
    expect(dispos?.[0].creneaux[0]).toBe("11:00");
  });

  it("garde les jours complets, vides, pour les griser", async () => {
    occupe.mockResolvedValue([{ debut: dateLocale("2026-11-03", "00:00").getTime(), fin: dateLocale("2026-11-03", "23:59").getTime() }]);
    const dispos = await disponibilites(maintenant);
    expect(dispos?.[0]).toEqual({ jour: "2026-11-03", creneaux: [] });
    expect(dispos?.[1].creneaux.length).toBeGreaterThan(0);
  });
});

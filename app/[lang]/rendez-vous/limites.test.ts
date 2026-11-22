import { beforeEach, describe, expect, it, vi } from "vitest";

// Porte « limites » : la prise de rendez-vous publique ne doit pas pouvoir être inondée.
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "198.51.100.7" }) }));
vi.mock("../../agenda/stockage", async () => {
  const { creerStockageFaux } = await import("../../agenda/stockage-faux");
  const faux = creerStockageFaux();
  return { commande: faux.commande, stockageConfigure: faux.stockageConfigure, __faux: faux };
});
vi.mock("../../agenda/google", () => ({
  agendaConfigure: () => true,
  periodesOccupees: vi.fn(async () => []),
  creerRendezvous: vi.fn(async () => ({})),
}));

import * as stockage from "../../agenda/stockage";
import * as google from "../../agenda/google";
import { creneauxDuJour, joursReservables } from "../../agenda/creneaux";
import { creneauxLibres, reserver } from "./actions";

const faux = (stockage as unknown as { __faux: { donnees: Map<string, string> } }).__faux;
const jour = joursReservables().find((j) => creneauxDuJour(j).length >= 8)!;

function formulaire(i: number) {
  const f = new FormData();
  f.set("jour", jour);
  f.set("heure", creneauxDuJour(jour)[i].heure);
  f.set("prenom", "Test");
  f.set("nom", "Robot");
  f.set("telephone", `06 00 00 00 ${String(10 + i)}`);
  f.set("consentement", "on");
  return f;
}

describe("réservation en ligne", () => {
  beforeEach(() => {
    faux.donnees.clear();
    vi.mocked(google.creerRendezvous).mockClear();
    vi.mocked(google.periodesOccupees).mockClear();
  });

  it("une même adresse ne crée pas plus de 5 rendez-vous par heure", async () => {
    for (let i = 0; i < 8; i++) await reserver({ statut: "attente" }, formulaire(i));
    expect(vi.mocked(google.creerRendezvous).mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("la lecture des créneaux libres est limitée (chaque appel interroge Google)", async () => {
    await Promise.all(Array.from({ length: 100 }, () => creneauxLibres(jour)));
    expect(vi.mocked(google.periodesOccupees).mock.calls.length).toBeLessThanOrEqual(30);
  });
});

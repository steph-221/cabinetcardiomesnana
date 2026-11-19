import { beforeAll, describe, expect, it } from "vitest";
import { creerJeton, jetonValide } from "./antirobot";

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(40);
});

describe("jeton anti-robot", () => {
  const t0 = 1_700_000_000_000;
  it("refuse un envoi trop rapide", () => {
    expect(jetonValide(creerJeton(t0), t0 + 1000)).toBe(false);
  });
  it("accepte un envoi après quelques secondes", () => {
    expect(jetonValide(creerJeton(t0), t0 + 10_000)).toBe(true);
  });
  it("refuse un jeton expiré, absent ou falsifié", () => {
    expect(jetonValide(creerJeton(t0), t0 + 7 * 3600_000)).toBe(false);
    expect(jetonValide("", t0 + 10_000)).toBe(false);
    expect(jetonValide(`${Math.floor(t0 / 1000) - 100}.${creerJeton(t0).split(".")[1]}`, t0 + 10_000)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { codeTotp, decoderBase32, verifierTotp } from "./totp";

// Vecteurs de test de la RFC 6238 (secret « 12345678901234567890 », 6 derniers chiffres)
const secret = Buffer.from("12345678901234567890");
const base32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP", () => {
  it("décode le base32", () => expect(decoderBase32(base32).equals(secret)).toBe(true));
  it("calcule les codes de la RFC 6238", () => {
    expect(codeTotp(secret, Math.floor(59 / 30))).toBe("287082");
    expect(codeTotp(secret, Math.floor(1111111109 / 30))).toBe("081804");
  });
  it("accepte le code courant et refuse les autres", () => {
    expect(verifierTotp(base32, "287082", 59_000)).toBe(1);
    expect(verifierTotp(base32, "287 082", 59_000)).toBe(1);
    expect(verifierTotp(base32, "000000", 59_000)).toBeNull();
    expect(verifierTotp(base32, "abc", 59_000)).toBeNull();
    expect(verifierTotp(base32, "287082", 59_000 + 120_000)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { adresseInterne } from "./lecture-site";

describe("adresseInterne", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1",
    "::1", "::", "fe80::1", "fd00::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::ffff:c0a8:1",
    "64:ff9b::7f00:1", "2002:7f00:1::1",
  ])("refuse %s", (ip) => expect(adresseInterne(ip)).toBe(true));
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "::ffff:808:808"])("accepte %s", (ip) =>
    expect(adresseInterne(ip)).toBe(false),
  );
});

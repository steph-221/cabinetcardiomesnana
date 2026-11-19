import { describe, expect, it } from "vitest";
import { adresseInterne, lireFlux } from "./lecture-site";

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

describe("lireFlux (podcasts et débats)", () => {
  const flux = `<?xml version="1.0"?><rss version="2.0"><channel><title>Podcast</title>
    <item><title>Débat : TAVI chez le patient à bas risque</title><link>https://exemple.org/ep1</link>
      <description>&lt;p&gt;Pour ou contre le TAVI&lt;/p&gt;</description>
      <enclosure url="https://exemple.org/ep1.mp3" length="1" type="audio/mpeg"/><pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate></item>
    <item><title>Article sans audio</title><link>https://exemple.org/a2</link>
      <enclosure url="http://exemple.org/a2.mp3" type="audio/mpeg"/></item></channel></rss>`;
  it("relève l'audio https et le résumé", () => {
    const [a, b] = lireFlux(flux, "https://exemple.org/feed");
    expect(a.media).toBe("https://exemple.org/ep1.mp3");
    expect(a.resume).toBe("Pour ou contre le TAVI");
    expect(b.media).toBe("");
  });
});

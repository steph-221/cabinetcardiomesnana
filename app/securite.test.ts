import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Contrôles du code source, à relancer après chaque grosse modification (surtout faite par l'IA).
// Ils ne remplacent pas les tests de comportement (limites, webhook…) : ils attrapent l'oubli classique,
// une nouvelle route ou action ajoutée sans contrôle d'accès.

const fichiers = (motif: string) =>
  execSync(`git ls-files '${motif}'`, { encoding: "utf8" }).split("\n").filter(Boolean);

// Seules entrées volontairement publiques ou protégées autrement (à justifier ici avant d'en ajouter)
const ROUTES_SANS_SESSION: Record<string, string> = {
  "app/api/resultats/route.ts": "secret partagé du script Google, essais limités (voir webhook.test.ts)",
};
const ACTIONS_PUBLIQUES: Record<string, string> = {
  creneauxLibres: "réservation en ligne : lecture des créneaux, limitée par adresse",
  reserver: "réservation en ligne : limites, jeton anti-robot, Turnstile facultatif",
  connexion: "page de connexion : essais limités",
  deconnexion: "ferme sa propre session",
};

describe("accès aux routes et actions", () => {
  it("toute route d'API exige une session, sauf celles justifiées", () => {
    const sans = fichiers("app/api/**/route.ts").filter(
      (f) => !/utilisateurConnecte|exigerUtilisateur/.test(readFileSync(f, "utf8")) && !ROUTES_SANS_SESSION[f],
    );
    expect(sans).toEqual([]);
  });

  it("toute action serveur vérifie la session elle-même, sauf celles justifiées", () => {
    const sans: string[] = [];
    for (const f of fichiers("app/**/*.ts").filter((f) => !f.endsWith(".test.ts"))) {
      const s = readFileSync(f, "utf8");
      if (!/^"use server";/m.test(s.slice(0, 40))) continue;
      for (const bloc of s.split(/\n(?=export async function )/).slice(1)) {
        const nom = /^export async function (\w+)/.exec(bloc)![1];
        const corps = bloc.split(/\n}\n/)[0];
        if (!/exiger\w*\(|utilisateurConnecte\(/.test(corps) && !ACTIONS_PUBLIQUES[nom]) sans.push(`${f} → ${nom}`);
      }
    }
    expect(sans).toEqual([]);
  });

  it("les pages de l'espace cabinet exigent une session (sauf la connexion)", () => {
    const sans = fichiers("app/**/espace/**/page.tsx").filter(
      (f) => !f.includes("/connexion/") && !/exiger\w*\(|utilisateurConnecte\(/.test(readFileSync(f, "utf8")),
    );
    expect(sans).toEqual([]);
  });
});

describe("secrets", () => {
  it("aucune variable publique ne porte un secret (seule la clé publique Turnstile est permise)", () => {
    const publiques = new Set<string>();
    for (const f of fichiers("app/**").concat(fichiers("*.ts"), fichiers("*.mjs"))) {
      if (!/\.(tsx?|mjs|js)$/.test(f)) continue;
      for (const m of readFileSync(f, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) publiques.add(m[0]);
    }
    expect([...publiques].filter((v) => v !== "NEXT_PUBLIC_TURNSTILE_SITE_KEY")).toEqual([]);
  });

  it("aucune clé ni mot de passe en clair dans les fichiers suivis par Git", () => {
    const motifs = [
      /sk-ant-[A-Za-z0-9_-]{10,}/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /postgres(ql)?:\/\/[^\s:@/]+:[^\s@/]+@/,
      /\bghp_[A-Za-z0-9]{20,}/,
      /\bAKIA[0-9A-Z]{16}\b/,
    ];
    const trouves = fichiers("*")
      .filter((f) => !/package-lock\.json|\.(png|jpg|ico|pdf)$/.test(f))
      .flatMap((f) => {
        const s = readFileSync(f, "utf8");
        return motifs.filter((m) => m.test(s)).map((m) => `${f} (${m.source.slice(0, 20)})`);
      });
    expect(trouves).toEqual([]);
  });

  it("aucun composant navigateur n'importe l'accès base, la session ou les clés", () => {
    const fautifs = fichiers("app/**/*.tsx")
      .filter((f) => /^\s*"use client"/.test(readFileSync(f, "utf8").slice(0, 40)))
      .filter((f) => /process\.env\.(?!NEXT_PUBLIC_)|dossier\/base"|agenda\/session"|agenda\/google"|node:crypto/.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });
});

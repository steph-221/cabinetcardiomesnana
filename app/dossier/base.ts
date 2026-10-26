// Base de données du dossier patient : Postgres Neon, ajouté depuis Vercel → Storage.
// Vercel renseigne automatiquement DATABASE_URL. Les tables sont créées et mises à jour toutes seules au
// premier accès (voir migrations.ts).

import { neon, neonConfig, types, type NeonQueryFunction } from "@neondatabase/serverless";
import { migrations } from "./migrations";

const url = () => process.env.DATABASE_URL;

export const baseConfiguree = () => Boolean(url());

// Développement local seulement : envoie les requêtes à un émulateur du point d'accès HTTP de Neon
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

// Les dates (sans heure) restent des chaînes « AAAA-MM-JJ », comme dans les formulaires.
// Réglage global : l'option `types` de neon() n'est pas appliquée aux requêtes HTTP.
types.setTypeParser(types.builtins.DATE, (valeur: string) => valeur);

let client: NeonQueryFunction<false, false> | null = null;
let pret: Promise<void> | null = null;

// Applique, dans l'ordre, les migrations pas encore faites. Le verrou évite que deux démarrages simultanés
// les appliquent en même temps ; chaque migration est écrite pour pouvoir être rejouée sans dommage.
async function migrer(sql: NeonQueryFunction<false, false>) {
  await sql`CREATE TABLE IF NOT EXISTS migrations (version integer PRIMARY KEY, appliquee_le timestamptz NOT NULL DEFAULT now())`;
  const faites = new Set((await sql`SELECT version FROM migrations`).map((r) => r.version as number));
  for (const [i, instructions] of migrations.entries()) {
    const version = i + 1;
    if (faites.has(version)) continue;
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(7240311)`,
      ...instructions.map((q) => sql.query(q)),
      sql`INSERT INTO migrations (version) VALUES (${version}) ON CONFLICT DO NOTHING`,
    ]);
  }
}

export async function base() {
  const chaine = url();
  if (!chaine) throw new Error("Base de données non configurée (DATABASE_URL)");
  client ??= neon(chaine);
  pret ??= migrer(client).catch((erreur) => {
    pret = null; // réessaiera à la prochaine requête
    throw erreur;
  });
  await pret;
  return client;
}

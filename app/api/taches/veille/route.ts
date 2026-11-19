// Veille de nuit : relit les sites et revues suivis et identifie leurs nouvelles publications (DOI, résumé, PDF libre).
// Appelée chaque nuit par la tâche planifiée Vercel (vercel.json), qui envoie CRON_SECRET en « Authorization: Bearer ».

import { secretTacheValide } from "../autorisation";
import { baseConfiguree } from "../../../dossier/base";
import { journaliser } from "../../../dossier/journal";
import { resoudrePublications, sitesARelire, verifierSite } from "../../../dossier/veille";
import { base } from "../../../dossier/base";

export const maxDuration = 120;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ erreur: "Tâche planifiée non activée (CRON_SECRET)." }, { status: 503 });
  if (!secretTacheValide(request)) return Response.json({ erreur: "Accès refusé." }, { status: 401 });
  if (!baseConfiguree()) return Response.json({ erreur: "Base de données non configurée." }, { status: 503 });

  const debut = Date.now();
  let relus = 0;
  let nouvelles = 0;
  let identifiees = 0;
  try {
    for (const id of await sitesARelire()) {
      const r = await verifierSite(id);
      relus++;
      if (!("erreur" in r)) nouvelles += r.nouvelles;
      if (Date.now() - debut > 80_000) break;
    }
    // Publications pas encore identifiées (premières lectures, pannes passées) : quelques-unes par site
    const sql = await base();
    const sites = await sql`SELECT DISTINCT site_id FROM publications WHERE resolue_le IS NULL AND etat <> 'ecartee'`;
    for (const s of sites) {
      if (Date.now() - debut > 100_000) break;
      identifiees += await resoudrePublications(s.site_id as number, 10);
    }
    await journaliser("veille de nuit", "veille des sites", null, `${relus} site(s) relu(s), ${nouvelles} nouveauté(s), ${identifiees} identifiée(s)`);
    return Response.json({ relus, nouvelles, identifiees });
  } catch (erreur) {
    console.error(erreur);
    return Response.json({ erreur: "La veille a échoué." }, { status: 500 });
  }
}

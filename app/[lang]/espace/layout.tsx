import { Suspense } from "react";
import { connection } from "next/server";
import { LogOut } from "lucide-react";
import { jourLocal } from "../../agenda/creneaux";
import { accesMedical, utilisateurConnecte } from "../../agenda/session";
import { baseConfiguree } from "../../dossier/base";
import { groupesAValider, total } from "../../dossier/a-valider";
import { espacesVisibles } from "../../dossier/navigation";
import { deconnexion } from "./actions";
import { lireLexique } from "../../dossier/lexique";
import { derniersDossiers } from "../../dossier/journal";
import { libellePatient } from "../../dossier/patients";
import { Navigation } from "./navigation";
import { Voix } from "./voix/voix";

// Les onglets restent en haut de chaque page de l'espace, pour passer d'une rubrique à l'autre
export default async function LayoutEspace({ children, params }: LayoutProps<"/[lang]/espace">) {
  const { lang } = await params;
  return (
    <>
      <Suspense fallback={null}>
        <Onglets langue={lang} />
      </Suspense>
      {children}
    </>
  );
}

async function Onglets({ langue }: { langue: string }) {
  await connection();
  // Pas d'onglets sur la page de connexion
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return null;
  const medical = accesMedical(utilisateur);

  // Éléments en attente : pastilles sur « À valider » et « Suivis »
  const pastilles: Record<string, number> = {};
  let lexique: { entendu: string; correct: string }[] = [];
  // Derniers dossiers ouverts par ce compte : on y revient en un clic depuis n'importe quelle page
  let recents: { id: number; libelle: string }[] = [];
  if (baseConfiguree()) {
    try {
      recents = (await derniersDossiers(utilisateur.identifiant, 5)).map((d) => ({ id: d.id, libelle: libellePatient(d) }));
    } catch (erreur) {
      console.error(erreur);
    }
    try {
      const groupes = await groupesAValider(jourLocal(new Date()), medical);
      pastilles["a-valider"] = total(groupes);
      pastilles.suivis = groupes.find((g) => g.cle === "suivis")?.n ?? 0;
      pastilles.messages = groupes.find((g) => g.cle === "messages")?.n ?? 0;
    } catch (erreur) {
      console.error(erreur);
    }
    if (medical) {
      try {
        lexique = (await lireLexique()).map(({ entendu, correct }) => ({ entendu, correct }));
      } catch (erreur) {
        console.error(erreur);
      }
    }
  }

  return (
    <>
      <Voix langue={langue} medical={medical} lexique={lexique} />
      <Navigation
        langue={langue}
        espaces={espacesVisibles({ medical, admin: utilisateur.admin })}
        secretaire={!medical}
        pastilles={pastilles}
        recents={recents}
        fin={
          <form action={deconnexion.bind(null, langue)}>
            <button
              type="submit"
              title={`Se déconnecter (${utilisateur.identifiant})`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Se déconnecter
            </button>
          </form>
        }
      />
    </>
  );
}

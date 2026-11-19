import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { lang as langueRacine } from "next/root-params";
import { estLangue } from "../../../../../cabinet";

// Ancienne page de modification : le formulaire est maintenant dans l'onglet Fiche du dossier (anciens liens conservés)
export default async function ModifierPatient({ params }: PageProps<"/[lang]/espace/patients/[id]/modifier">) {
  const lang = await langueRacine();
  if (!estLangue(lang)) return null;
  return (
    <Suspense fallback={<p className="p-8 text-slate-500">Ouverture du dossier…</p>}>
      <Vers langue={lang} params={params} />
    </Suspense>
  );
}

async function Vers({ langue, params }: { langue: string; params: PageProps<"/[lang]/espace/patients/[id]/modifier">["params"] }): Promise<never> {
  await connection();
  const { id } = await params;
  return redirect(`/${langue}/espace/patients/${encodeURIComponent(id)}?onglet=fiche`);
}

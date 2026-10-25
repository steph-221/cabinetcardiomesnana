import type { Metadata } from "next";
import { cabinet, estLangue } from "../../cabinet";
import { getDictionnaire } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/mentions-legales">): Promise<Metadata> {
  const { lang } = await params;
  return estLangue(lang) ? { title: getDictionnaire(lang).mentions.titre } : {};
}

export default async function MentionsLegales({ params }: PageProps<"/[lang]/mentions-legales">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  const t = getDictionnaire(lang);
  const m = t.mentions;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">{m.titre}</h1>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">{m.editeur}</h2>
          <p>
            {t.nom} — {cabinet.medecin}
            <br />
            {t.infos.adresseLignes.join(", ")}
            <br />
            {m.telephone} :{" "}
            <span dir="ltr">
              {cabinet.telephones.fixe.numero} · {cabinet.telephones.mobile.numero}
            </span>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">{m.hebergement}</h2>
          <p dir="ltr" className="text-start">
            {m.hebergeur} —{" "}
            <a href="https://vercel.com" className="text-red-600 hover:underline">
              vercel.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">{m.informatif}</h2>
          <p>{m.informatifTexte}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">{m.donnees}</h2>
          <p>{m.donneesTexte}</p>
        </section>
      </div>
    </div>
  );
}

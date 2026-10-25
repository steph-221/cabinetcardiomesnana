import type { Metadata } from "next";
import { cabinet } from "../cabinet";

export const metadata: Metadata = {
  title: "Mentions légales",
};

export default function MentionsLegales() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Mentions légales</h1>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Éditeur du site</h2>
          <p>
            {cabinet.nom} — {cabinet.medecin.nom}, {cabinet.medecin.titre.toLowerCase()}
            <br />
            {cabinet.adresse.rue}, {cabinet.adresse.ville}
            <br />
            Téléphone : {cabinet.telephone} · E-mail : {cabinet.email}
            <br />
            N° RPPS : {cabinet.medecin.rpps}
            <br />
            Inscrit au Conseil départemental de l&apos;Ordre des médecins de [département].
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Hébergement</h2>
          <p>
            Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis —{" "}
            <a href="https://vercel.com" className="text-rose-600 hover:underline">
              vercel.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Caractère informatif</h2>
          <p>
            Les informations présentées sur ce site sont fournies à titre informatif et ne remplacent pas une
            consultation médicale. En cas d&apos;urgence, appelez le 15 ou le 112.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Données personnelles</h2>
          <p>
            Ce site ne collecte aucune donnée personnelle et n&apos;utilise pas de cookies de suivi. La prise de
            rendez-vous en ligne est assurée par un service tiers, soumis à sa propre politique de confidentialité.
          </p>
        </section>
      </div>
    </div>
  );
}

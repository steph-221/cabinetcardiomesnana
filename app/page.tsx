import Image from "next/image";
import {
  Activity,
  CalendarCheck,
  ChevronRight,
  Clock,
  HeartPulse,
  MapPin,
  Phone,
  Stethoscope,
  TriangleAlert,
  Waves,
} from "lucide-react";
import { cabinet } from "./cabinet";
import bureau from "../public/cabinet/bureau.jpg";
import salleExamen from "../public/cabinet/salle-examen.jpg";
import salleAttente from "../public/cabinet/salle-attente.jpg";
import facade from "../public/cabinet/facade.jpg";

const soins = [
  {
    icone: Stethoscope,
    titre: "Consultation de cardiologie",
    texte:
      "Bilan cardiovasculaire, dépistage des facteurs de risque, suivi des maladies cardiaques et avis avant une chirurgie ou une reprise du sport.",
  },
  {
    icone: Activity,
    titre: "Électrocardiogramme (ECG)",
    texte: "Enregistrement de l'activité électrique du cœur, réalisé au cabinet en quelques minutes.",
  },
  {
    icone: Waves,
    titre: "Échocardiographie",
    texte:
      "Échographie du cœur pour évaluer la contraction, les valves et les cavités cardiaques, sans douleur ni rayons.",
  },
  {
    icone: HeartPulse,
    titre: "Hypertension et prévention",
    texte:
      "Diagnostic et suivi de l'hypertension artérielle, du cholestérol et du diabète pour protéger le cœur et les artères.",
  },
];

const photos = [
  { src: salleExamen, alt: "Salle d'examen avec échographe et électrocardiographe" },
  { src: bureau, alt: "Bureau de consultation" },
  { src: salleAttente, alt: "Salle d'attente" },
  { src: facade, alt: "Façade de l'immeuble avec l'enseigne du cabinet de cardiologie" },
];

const aApporter = [
  "Carte d'identité nationale (CIN)",
  "Carte de mutuelle ou d'assurance maladie, le cas échéant",
  "Lettre de votre médecin traitant",
  "Ordonnances et liste de vos traitements en cours",
  "Résultats récents : analyses de sang, ECG, comptes rendus d'examens ou d'hospitalisation",
];

export default function Accueil() {
  return (
    <>
      {/* Présentation */}
      <section className="bg-gradient-to-b from-red-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-wide text-red-600">
              {cabinet.medecin.nom} · {cabinet.medecin.titre}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{cabinet.nom}</h1>
            <p className="mt-4 text-lg text-slate-600">{cabinet.slogan}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {cabinet.telephones.map((t, i) => (
                <a
                  key={t.lien}
                  href={`tel:${t.lien}`}
                  className={
                    i === 0
                      ? "inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700"
                      : "inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 font-medium text-slate-800 hover:border-slate-400"
                  }
                >
                  <Phone className="h-5 w-5" aria-hidden />
                  {t.numero}
                </a>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-4 w-4" aria-hidden />
              {cabinet.adresse.ligne2}
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl shadow-lg">
            <Image
              src={salleExamen}
              alt="Salle d'examen du cabinet"
              priority
              placeholder="blur"
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Urgences */}
      <section className="border-y border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-4 text-amber-900 sm:px-6">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm">
            <strong>Urgence :</strong> en cas de douleur thoracique, d&apos;essoufflement brutal ou de malaise, n&apos;attendez
            pas un rendez-vous : appelez immédiatement le <strong>141</strong> (SAMU) ou le <strong>15</strong>{" "}
            (Protection civile), ou rendez-vous aux urgences les plus proches.
          </p>
        </div>
      </section>

      {/* Soins et examens */}
      <section id="soins" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">Soins & examens</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Les principaux examens cardiologiques sont réalisés directement au cabinet.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {soins.map(({ icone: Icone, titre, texte }) => (
            <article key={titre} className="rounded-2xl border border-slate-200 p-6 transition hover:shadow-md">
              <div className="mb-4 inline-flex rounded-xl bg-red-50 p-3">
                <Icone className="h-6 w-6 text-red-600" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{texte}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Le médecin */}
      <section id="medecin" className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center">
          <div className="overflow-hidden rounded-3xl shadow-md">
            <Image
              src={bureau}
              alt="Bureau de consultation"
              placeholder="blur"
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{cabinet.medecin.nom}</h2>
            <p className="mt-1 font-medium text-red-600">{cabinet.medecin.titre}</p>
            <p className="mt-4 leading-relaxed text-slate-600">{cabinet.medecin.presentation}</p>
          </div>
        </div>
      </section>

      {/* Le cabinet en images */}
      <section id="cabinet" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">Le cabinet</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Un cabinet récent, lumineux et équipé, au cœur de Mesnana.</p>
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.alt} className="overflow-hidden rounded-2xl bg-slate-100">
              <Image
                src={p.src}
                alt={p.alt}
                placeholder="blur"
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="aspect-[3/4] w-full object-cover transition duration-300 hover:scale-105"
              />
            </figure>
          ))}
        </div>
      </section>

      {/* Infos pratiques */}
      <section id="infos" className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold text-slate-900">Infos pratiques</h2>
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <MapPin className="h-5 w-5 text-red-600" aria-hidden />
                Adresse
              </h3>
              <address className="mt-4 text-sm not-italic text-slate-700">
                {cabinet.adresse.ligne1}
                <br />
                {cabinet.adresse.ligne2}, {cabinet.adresse.pays}
              </address>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <iframe
                  title="Plan d'accès au cabinet"
                  src={cabinet.adresse.carteIntegree}
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                href={cabinet.adresse.carte}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
              >
                Itinéraire avec Google Maps <ChevronRight className="h-4 w-4" aria-hidden />
              </a>
            </div>

            <div className="flex flex-col gap-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Clock className="h-5 w-5 text-red-600" aria-hidden />
                  Horaires
                </h3>
                {cabinet.horaires.length > 0 && (
                  <dl className="mt-4 divide-y divide-slate-100 text-sm">
                    {cabinet.horaires.map((h) => (
                      <div key={h.jour} className="flex justify-between gap-4 py-2">
                        <dt className="font-medium text-slate-700">{h.jour}</dt>
                        <dd className="text-right text-slate-600">{h.heures}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="mt-4 text-sm text-slate-600">{cabinet.horairesNote}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <CalendarCheck className="h-5 w-5 text-red-600" aria-hidden />
                  Pour votre rendez-vous
                </h3>
                <p className="mt-4 text-sm text-slate-600">Pensez à apporter :</p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
                  {aApporter.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-red-600">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 text-white sm:px-6 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold">Prendre rendez-vous</h2>
            <p className="mt-2 text-red-100">Contactez le secrétariat par téléphone pour fixer votre rendez-vous.</p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            {cabinet.telephones.map((t) => (
              <a
                key={t.lien}
                href={`tel:${t.lien}`}
                className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 font-medium text-red-700 hover:bg-red-50"
              >
                <Phone className="h-5 w-5" aria-hidden />
                <span className="text-sm font-normal text-red-500">{t.libelle}</span>
                {t.numero}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

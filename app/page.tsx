import {
  Accessibility,
  Activity,
  Bus,
  CalendarCheck,
  Car,
  ChevronRight,
  Clock,
  Footprints,
  Gauge,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  Timer,
  TriangleAlert,
  UserRound,
  Waves,
} from "lucide-react";
import { cabinet } from "./cabinet";

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
    icone: Timer,
    titre: "Holter ECG",
    texte:
      "Enregistrement du rythme cardiaque sur 24 à 72 heures pour rechercher des palpitations ou des troubles du rythme.",
  },
  {
    icone: Gauge,
    titre: "MAPA",
    texte:
      "Mesure ambulatoire de la pression artérielle sur 24 heures pour diagnostiquer et suivre l'hypertension.",
  },
  {
    icone: Footprints,
    titre: "Épreuve d'effort",
    texte:
      "Test sur vélo ou tapis pour étudier le cœur à l'effort, notamment avant la reprise d'une activité sportive.",
  },
];

const aApporter = [
  "Carte Vitale et carte de mutuelle",
  "Courrier de votre médecin traitant",
  "Ordonnances et liste de vos traitements en cours",
  "Résultats récents : prises de sang, ECG, comptes rendus d'examens ou d'hospitalisation",
];

export default function Accueil() {
  return (
    <>
      {/* Présentation */}
      <section className="bg-gradient-to-b from-rose-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-wide text-rose-600">
              {cabinet.medecin.nom} · {cabinet.medecin.titre}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{cabinet.nom}</h1>
            <p className="mt-4 text-lg text-slate-600">{cabinet.slogan}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={cabinet.rendezVous}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-6 py-3 font-medium text-white hover:bg-rose-700"
              >
                <CalendarCheck className="h-5 w-5" aria-hidden />
                Prendre rendez-vous en ligne
              </a>
              <a
                href={`tel:${cabinet.telephoneLien}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 font-medium text-slate-800 hover:border-slate-400"
              >
                <Phone className="h-5 w-5" aria-hidden />
                {cabinet.telephone}
              </a>
            </div>
          </div>
          <div className="relative hidden justify-center md:flex" aria-hidden>
            <div className="flex h-72 w-72 items-center justify-center rounded-full bg-rose-100">
              <HeartPulse className="h-36 w-36 text-rose-600" strokeWidth={1.25} />
            </div>
          </div>
        </div>
      </section>

      {/* Urgences */}
      <section className="border-y border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-4 text-amber-900 sm:px-6">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm">
            <strong>Urgence :</strong> en cas de douleur thoracique, d&apos;essoufflement brutal ou de malaise, ne
            prenez pas rendez-vous : appelez immédiatement le <strong>15</strong> (SAMU) ou le <strong>112</strong>.
          </p>
        </div>
      </section>

      {/* Soins et examens */}
      <section id="soins" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">Soins & examens</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Les principaux examens cardiologiques sont réalisés directement au cabinet.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {soins.map(({ icone: Icone, titre, texte }) => (
            <article key={titre} className="rounded-2xl border border-slate-200 p-6 transition hover:shadow-md">
              <div className="mb-4 inline-flex rounded-xl bg-rose-50 p-3">
                <Icone className="h-6 w-6 text-rose-600" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{texte}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Le médecin */}
      <section id="medecin" className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          <div className="flex justify-center md:justify-start">
            <div className="flex h-48 w-48 items-center justify-center rounded-full bg-white shadow-sm">
              <UserRound className="h-24 w-24 text-slate-300" aria-hidden />
            </div>
          </div>
          <div className="md:col-span-2">
            <h2 className="text-3xl font-bold text-slate-900">{cabinet.medecin.nom}</h2>
            <p className="mt-1 font-medium text-rose-600">{cabinet.medecin.titre}</p>
            <p className="mt-4 leading-relaxed text-slate-600">{cabinet.medecin.presentation}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-700">
              <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
              {cabinet.medecin.secteur}
            </p>
          </div>
        </div>
      </section>

      {/* Infos pratiques */}
      <section id="infos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">Infos pratiques</h2>
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Clock className="h-5 w-5 text-rose-600" aria-hidden />
              Horaires
            </h3>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              {cabinet.horaires.map((h) => (
                <div key={h.jour} className="flex justify-between gap-4 py-2">
                  <dt className="font-medium text-slate-700">{h.jour}</dt>
                  <dd className="text-right text-slate-600">{h.heures}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-slate-500">Consultations uniquement sur rendez-vous.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <MapPin className="h-5 w-5 text-rose-600" aria-hidden />
              Accès
            </h3>
            <address className="mt-4 text-sm not-italic text-slate-700">
              {cabinet.adresse.rue}
              <br />
              {cabinet.adresse.ville}
              <br />
              <span className="text-slate-500">{cabinet.adresse.complement}</span>
            </address>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <Bus className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                {cabinet.acces.transports}
              </li>
              <li className="flex gap-2">
                <Car className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                {cabinet.acces.stationnement}
              </li>
              <li className="flex gap-2">
                <Accessibility className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                {cabinet.acces.pmr}
              </li>
            </ul>
            <a
              href={cabinet.adresse.carte}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700"
            >
              Voir sur la carte <ChevronRight className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <CalendarCheck className="h-5 w-5 text-rose-600" aria-hidden />
              Pour votre rendez-vous
            </h3>
            <p className="mt-4 text-sm text-slate-600">Pensez à apporter :</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              {aApporter.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              En cas d&apos;empêchement, merci de prévenir le cabinet au moins 24 h à l&apos;avance.
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-rose-600">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 text-white sm:px-6 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl font-bold">Prendre rendez-vous</h2>
            <p className="mt-2 text-rose-100">
              Réservez en ligne 24 h/24 ou contactez le secrétariat aux heures d&apos;ouverture.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <a
              href={cabinet.rendezVous}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-medium text-rose-700 hover:bg-rose-50"
            >
              <CalendarCheck className="h-5 w-5" aria-hidden />
              Rendez-vous en ligne
            </a>
            <a href={`tel:${cabinet.telephoneLien}`} className="inline-flex items-center gap-2 hover:underline">
              <Phone className="h-5 w-5" aria-hidden />
              {cabinet.telephone}
            </a>
            <a href={`mailto:${cabinet.email}`} className="inline-flex items-center gap-2 hover:underline">
              <Mail className="h-5 w-5" aria-hidden />
              {cabinet.email}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

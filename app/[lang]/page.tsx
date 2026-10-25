import Image from "next/image";
import {
  Activity,
  CalendarCheck,
  ChevronRight,
  Clock,
  Footprints,
  Gauge,
  HeartPulse,
  MapPin,
  MessageCircle,
  Phone,
  Stethoscope,
  Timer,
  TriangleAlert,
  Waves,
} from "lucide-react";
import { cabinet, estLangue } from "../cabinet";
import { getDictionnaire } from "./dictionaries";
import bureau from "../../public/cabinet/bureau.jpg";
import salleExamen from "../../public/cabinet/salle-examen.jpg";
import salleAttente from "../../public/cabinet/salle-attente.jpg";
import facade from "../../public/cabinet/facade.jpg";

// Dans le même ordre que soins.liste des dictionnaires
const iconesSoins = [Stethoscope, Activity, Waves, HeartPulse, Timer, Gauge, Footprints];
const photos = [salleExamen, bureau, salleAttente, facade];

export default async function Accueil({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!estLangue(lang)) return null;
  const t = getDictionnaire(lang);
  const { fixe, mobile } = cabinet.telephones;

  return (
    <>
      {/* Présentation */}
      <section className="bg-gradient-to-b from-red-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-wide text-red-600">
              {cabinet.medecin} · {t.accueil.titreMedecin}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{t.nom}</h1>
            <p className="mt-4 text-lg text-slate-600">{t.accueil.slogan}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`tel:${fixe.lien}`}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700"
              >
                <Phone className="h-5 w-5" aria-hidden />
                <span dir="ltr">{fixe.numero}</span>
              </a>
              <a
                href={cabinet.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
              >
                <MessageCircle className="h-5 w-5" aria-hidden />
                WhatsApp
              </a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-4 w-4" aria-hidden />
              {t.accueil.ville}
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl shadow-lg">
            <Image
              src={salleExamen}
              alt={t.accueil.photo}
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
            <strong>{t.urgence.titre}</strong> {t.urgence.texte}
          </p>
        </div>
      </section>

      {/* Soins et examens */}
      <section id="soins" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">{t.soins.titre}</h2>
        <p className="mt-2 max-w-2xl text-slate-600">{t.soins.intro}</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {t.soins.liste.map(({ titre, texte }, i) => {
            const Icone = iconesSoins[i] ?? HeartPulse;
            return (
              <article key={titre} className="rounded-2xl border border-slate-200 p-6 transition hover:shadow-md">
                <div className="mb-4 inline-flex rounded-xl bg-red-50 p-3">
                  <Icone className="h-6 w-6 text-red-600" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{texte}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Le médecin */}
      <section id="medecin" className="bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center">
          <div className="overflow-hidden rounded-3xl shadow-md">
            <Image
              src={bureau}
              alt={t.medecin.photo}
              placeholder="blur"
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{cabinet.medecin}</h2>
            <p className="mt-1 font-medium text-red-600">{t.accueil.titreMedecin}</p>
            <p className="mt-4 leading-relaxed text-slate-600">{t.medecin.presentation}</p>
          </div>
        </div>
      </section>

      {/* Le cabinet en images */}
      <section id="cabinet" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold text-slate-900">{t.cabinet.titre}</h2>
        <p className="mt-2 max-w-2xl text-slate-600">{t.cabinet.intro}</p>
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {photos.map((src, i) => (
            <figure key={src.src} className="overflow-hidden rounded-2xl bg-slate-100">
              <Image
                src={src}
                alt={t.cabinet.photos[i]}
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
          <h2 className="text-3xl font-bold text-slate-900">{t.infos.titre}</h2>
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <MapPin className="h-5 w-5 text-red-600" aria-hidden />
                {t.infos.adresse}
              </h3>
              <address className="mt-4 text-sm not-italic text-slate-700">
                {t.infos.adresseLignes[0]}
                <br />
                {t.infos.adresseLignes[1]}
              </address>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <iframe
                  title={t.infos.carte}
                  src={cabinet.carteIntegree}
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                href={cabinet.carte}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
              >
                {t.infos.itineraire} <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </a>
            </div>

            <div className="flex flex-col gap-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Clock className="h-5 w-5 text-red-600" aria-hidden />
                  {t.infos.horaires}
                </h3>
                <dl className="mt-4 divide-y divide-slate-100 text-sm">
                  {cabinet.horaires.map((heures, i) => (
                    <div key={t.infos.jours[i]} className="flex justify-between gap-4 py-2">
                      <dt className="font-medium text-slate-700">{t.infos.jours[i]}</dt>
                      <dd className={heures ? "text-slate-600" : "text-slate-400"} dir={heures ? "ltr" : undefined}>
                        {heures ?? t.infos.ferme}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-slate-500">{t.infos.horairesNote}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <CalendarCheck className="h-5 w-5 text-red-600" aria-hidden />
                  {t.infos.rdv}
                </h3>
                <p className="mt-4 text-sm text-slate-600">{t.infos.aApporterIntro}</p>
                <ul className="mt-2 list-disc space-y-2 ps-5 text-sm text-slate-600">
                  {t.infos.aApporter.map((a) => (
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
            <h2 className="text-3xl font-bold">{t.contact.titre}</h2>
            <p className="mt-2 text-red-100">{t.contact.texte}</p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            {[
              { ...fixe, libelle: t.contact.fixe },
              { ...mobile, libelle: t.contact.mobile },
            ].map((tel) => (
              <a
                key={tel.lien}
                href={`tel:${tel.lien}`}
                className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 font-medium text-red-700 hover:bg-red-50"
              >
                <Phone className="h-5 w-5" aria-hidden />
                <span className="text-sm font-normal text-red-500">{tel.libelle}</span>
                <span dir="ltr">{tel.numero}</span>
              </a>
            ))}
            <a
              href={cabinet.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
              {t.contact.whatsapp}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

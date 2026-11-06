import Image from "next/image";
import Link from "next/link";
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
import { donneesStructurees, jsonLd } from "../referencement";
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(donneesStructurees(lang, t)) }} />

      {/* Présentation : titre centré, produit réel (la salle d'examen) qui se déploie au défilement */}
      <section className="bg-papier">
        <div className="hero-fond mx-auto max-w-4xl px-6 pb-10 pt-16 text-center md:pt-24">
          <p className="mb-4 text-base font-semibold text-accent">
            {cabinet.medecin} · {t.accueil.titreMedecin}
          </p>
          <h1 className="titre-hero text-encre">{t.nom}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-snug text-gris md:text-2xl">{t.accueil.slogan}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link
              href={`/${lang}/rendez-vous`}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-medium text-white transition-colors hover:bg-accent-fonce"
            >
              <CalendarCheck className="h-5 w-5" aria-hidden />
              {t.nav.rdv}
            </Link>
            <a
              href={`tel:${fixe.lien}`}
              className="inline-flex items-center gap-1 text-lg font-medium text-accent hover:underline"
            >
              <Phone className="h-5 w-5" aria-hidden />
              <span dir="ltr">{fixe.numero}</span>
              <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden />
            </a>
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-gris">
            <MapPin className="h-4 w-4" aria-hidden />
            {t.accueil.ville}
          </p>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
          <div className="zoom-defilement origin-top overflow-hidden rounded-[2rem] bg-brume md:rounded-[2.5rem]">
            <Image
              src={salleExamen}
              alt={t.accueil.photo}
              priority
              placeholder="blur"
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Urgences : sobre, lisible, sans alarme visuelle */}
      <section className="bg-brume">
        <div className="mx-auto flex max-w-4xl items-start gap-3 px-6 py-5 text-encre">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <p className="text-sm leading-relaxed text-gris">
            <strong className="font-semibold text-encre">{t.urgence.titre}</strong> {t.urgence.texte}
          </p>
        </div>
      </section>

      {/* Soins et examens : le seul bento de la page */}
      <section id="soins" className="bg-papier">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="apparait max-w-3xl">
            <h2 className="titre-section text-encre">{t.soins.titre}</h2>
            <p className="mt-4 text-xl leading-snug text-gris">{t.soins.intro}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.soins.liste.map(({ titre, texte }, i) => {
              const Icone = iconesSoins[i] ?? HeartPulse;
              return (
                <article
                  key={titre}
                  className={`apparait rounded-3xl bg-brume p-7 transition-transform duration-300 ease-out hover:-translate-y-1 ${
                    i === 0 ? "sm:col-span-2 lg:row-span-1" : ""
                  }`}
                >
                  <Icone className="h-8 w-8 text-accent" strokeWidth={1.6} aria-hidden />
                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-encre">{titre}</h3>
                  <p className="mt-2 text-base leading-relaxed text-gris">{texte}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Le médecin */}
      <section id="medecin" className="bg-brume">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 md:items-center md:py-28">
          <div className="zoom-defilement overflow-hidden rounded-[2rem]">
            <Image
              src={bureau}
              alt={t.medecin.photo}
              placeholder="blur"
              sizes="(min-width: 768px) 50vw, 100vw"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div className="apparait">
            <p className="text-base font-semibold text-accent">{t.accueil.titreMedecin}</p>
            <h2 className="titre-section mt-2 text-encre">{cabinet.medecin}</h2>
            <p className="mt-6 text-xl leading-relaxed text-gris">{t.medecin.presentation}</p>
          </div>
        </div>
      </section>

      {/* Le cabinet en images */}
      <section id="cabinet" className="bg-papier">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <div className="apparait max-w-3xl">
            <h2 className="titre-section text-encre">{t.cabinet.titre}</h2>
            <p className="mt-4 text-xl leading-snug text-gris">{t.cabinet.intro}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {photos.map((src, i) => (
              <figure key={src.src} className="apparait group relative overflow-hidden rounded-3xl bg-brume">
                <Image
                  src={src}
                  alt={t.cabinet.photos[i]}
                  placeholder="blur"
                  sizes="(min-width: 1152px) 552px, (min-width: 640px) 50vw, 100vw"
                  className="aspect-[4/3] w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-6 pb-5 pt-14 text-base font-medium text-white">
                  {t.cabinet.photos[i]}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Infos pratiques */}
      <section id="infos" className="bg-brume">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="titre-section apparait text-encre">{t.infos.titre}</h2>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl bg-papier p-7 lg:col-span-2">
              <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-encre">
                <MapPin className="h-5 w-5 text-accent" aria-hidden />
                {t.infos.adresse}
              </h3>
              <address className="mt-4 text-base not-italic leading-relaxed text-gris">
                {t.infos.adresseLignes[0]}
                <br />
                {t.infos.adresseLignes[1]}
              </address>
              <div className="mt-5 overflow-hidden rounded-2xl">
                <iframe
                  title={t.infos.carte}
                  src={cabinet.carteIntegree}
                  className="h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                href={cabinet.carte}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1 text-base font-medium text-accent hover:underline"
              >
                {t.infos.itineraire} <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </a>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-3xl bg-papier p-7">
                <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-encre">
                  <Clock className="h-5 w-5 text-accent" aria-hidden />
                  {t.infos.horaires}
                </h3>
                <dl className="mt-4 divide-y divide-filet/60 text-base">
                  {cabinet.horaires.map((heures, i) => (
                    <div key={t.infos.jours[i]} className="flex justify-between gap-4 py-2.5">
                      <dt className="font-medium text-encre">{t.infos.jours[i]}</dt>
                      <dd className={heures ? "text-gris" : "text-gris/60"} dir={heures ? "ltr" : undefined}>
                        {heures ?? t.infos.ferme}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm text-gris">{t.infos.horairesNote}</p>
              </div>

              <div className="rounded-3xl bg-papier p-7">
                <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-encre">
                  <CalendarCheck className="h-5 w-5 text-accent" aria-hidden />
                  {t.infos.rdv}
                </h3>
                <p className="mt-4 text-base text-gris">{t.infos.aApporterIntro}</p>
                <ul className="mt-2 list-disc space-y-2 ps-5 text-base text-gris marker:text-filet">
                  {t.infos.aApporter.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact : un moment sombre, délibéré et unique */}
      <section id="contact" className="bg-encre">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:items-center md:py-28">
          <div className="apparait">
            <h2 className="titre-section text-white">{t.contact.titre}</h2>
            <p className="mt-4 text-xl leading-snug text-white/70">{t.contact.texte}</p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <Link
              href={`/${lang}/rendez-vous`}
              className="inline-flex items-center gap-3 rounded-full bg-accent px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-fonce"
            >
              <CalendarCheck className="h-5 w-5" aria-hidden />
              {t.nav.rdv}
            </Link>
            {[
              { ...fixe, libelle: t.contact.fixe },
              { ...mobile, libelle: t.contact.mobile },
            ].map((tel) => (
              <a
                key={tel.lien}
                href={`tel:${tel.lien}`}
                className="inline-flex items-center gap-3 rounded-full bg-white/10 px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/20"
              >
                <Phone className="h-5 w-5" aria-hidden />
                <span className="text-sm font-normal text-white/60">{tel.libelle}</span>
                <span dir="ltr">{tel.numero}</span>
              </a>
            ))}
            <a
              href={cabinet.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full bg-white/10 px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/20"
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

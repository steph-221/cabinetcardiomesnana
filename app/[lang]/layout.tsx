import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Geist, Noto_Sans_Arabic } from "next/font/google";
import "../globals.css";
import { cabinet, estLangue, langues } from "../cabinet";
import { alternatesPour } from "../referencement";
import { getDictionnaire } from "./dictionaries";
import { Header } from "./header";
import { Footer } from "./footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

export function generateStaticParams() {
  return langues.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!estLangue(lang)) return {};
  const t = getDictionnaire(lang);
  return {
    metadataBase: new URL(cabinet.site),
    title: { default: t.meta.titre, template: `%s — ${t.nom}` },
    description: t.meta.description,
    alternates: alternatesPour(lang, ""),
    openGraph: {
      type: "website",
      siteName: t.nom,
      title: t.meta.titre,
      description: t.meta.description,
      url: `/${lang}`,
      locale: { fr: "fr_MA", ar: "ar_MA", en: "en_US", es: "es_ES" }[lang],
      images: [{ url: "/cabinet/salle-examen.jpg", alt: t.accueil.photo }],
    },
    twitter: { card: "summary_large_image" },
    other: {
      "geo.region": "MA",
      "geo.placename": "Tanger",
      "geo.position": `${cabinet.position.latitude};${cabinet.position.longitude}`,
      ICBM: `${cabinet.position.latitude}, ${cabinet.position.longitude}`,
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!estLangue(lang)) notFound();
  const t = getDictionnaire(lang);

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${notoArabic.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header langue={lang} t={t} />
        <main className="flex-1">{children}</main>
        <Footer langue={lang} t={t} />
      </body>
    </html>
  );
}

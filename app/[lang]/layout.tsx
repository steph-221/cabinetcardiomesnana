import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Geist, Noto_Sans_Arabic } from "next/font/google";
import "../globals.css";
import { estLangue, langues } from "../cabinet";
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
    title: { default: t.meta.titre, template: `%s — ${t.nom}` },
    description: t.meta.description,
    alternates: {
      languages: Object.fromEntries(langues.map((l) => [l, `/${l}`])),
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

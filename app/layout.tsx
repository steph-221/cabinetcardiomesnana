import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { cabinet } from "./cabinet";
import { Header } from "./header";
import { Footer } from "./footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${cabinet.nom} — ${cabinet.medecin.nom}, cardiologue`,
    template: `%s — ${cabinet.nom}`,
  },
  description: `${cabinet.nom} : consultations de cardiologie, ECG, échocardiographie, Holter, MAPA et épreuve d'effort. Prise de rendez-vous en ligne.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full scroll-smooth antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

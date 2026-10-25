import { NextResponse, type NextRequest } from "next/server";
import { estLangue, langueParDefaut, langues } from "./app/cabinet";

// Choisit la première langue du navigateur que le site propose
function langueDuNavigateur(request: NextRequest) {
  const entete = request.headers.get("accept-language") ?? "";
  for (const partie of entete.split(",")) {
    const code = partie.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (estLangue(code)) return code;
  }
  return langueParDefaut;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const aUneLangue = langues.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (aUneLangue) return;

  request.nextUrl.pathname = `/${langueDuNavigateur(request)}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Ignore les fichiers internes de Next.js et les fichiers statiques (images, favicon…)
  matcher: ["/((?!_next|.*\\..*).*)"],
};

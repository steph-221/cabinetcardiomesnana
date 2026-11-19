// Vérification anti-robot Cloudflare Turnstile pour la réservation en ligne.
// Activée si TURNSTILE_SECRET_KEY (serveur) et NEXT_PUBLIC_TURNSTILE_SITE_KEY (navigateur) sont renseignées ;
// sinon la réservation fonctionne comme avant (champ piège et limitation par adresse seulement).

export const turnstileActif = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

export async function verifierTurnstile(jeton: string, adresse: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!jeton) return false;
  try {
    const reponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: jeton, ...(adresse !== "inconnue" ? { remoteip: adresse } : {}) }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    return ((await reponse.json()) as { success?: boolean }).success === true;
  } catch (erreur) {
    console.error("Turnstile indisponible", erreur);
    return false;
  }
}

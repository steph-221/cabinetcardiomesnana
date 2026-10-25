// Informations du cabinet communes à toutes les langues.
// Les textes traduits sont dans app/[lang]/dictionaries/.

export const cabinet = {
  medecin: "Dr Taouab Zogarh Cursoux",
  carte:
    "https://www.google.com/maps/search/?api=1&query=Dr+Taouab+Zogarh+Cursoux+Cabinet+de+cardiologie+mesnana+Tanger",
  carteIntegree: "https://maps.google.com/maps?q=35.752777,-5.85083&z=17&output=embed",
  telephones: {
    fixe: { numero: "05 39 31 85 50", lien: "+212539318550" },
    mobile: { numero: "07 16 74 49 13", lien: "+212716744913" },
  },
  whatsapp: "https://wa.me/212716744913",
  // Du lundi au dimanche, dans l'ordre ; null = fermé.
  horaires: [
    "09:00 – 17:00",
    "09:00 – 17:00",
    "09:00 – 17:00",
    "09:00 – 17:00",
    "09:00 – 17:00",
    "09:30 – 14:00",
    null,
  ] as (string | null)[],
};

export const langues = ["fr", "ar", "en", "es"] as const;
export type Langue = (typeof langues)[number];
export const langueParDefaut: Langue = "fr";

export const nomsLangues: Record<Langue, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
  es: "Español",
};

export const estLangue = (valeur: string): valeur is Langue => (langues as readonly string[]).includes(valeur);

// Types de sources de la bibliothèque et libellés communs au serveur et au navigateur (aucun accès à la base)

export const typesSource = [
  { cle: "recommandation", libelle: "Recommandation" },
  { cle: "rcp", libelle: "RCP / notice de médicament" },
  { cle: "article", libelle: "Article" },
  { cle: "protocole", libelle: "Protocole du cabinet" },
  { cle: "fiche", libelle: "Fiche validée par le médecin" },
] as const;

export type TypeSource = (typeof typesSource)[number]["cle"];
export const estTypeSource = (t: string): t is TypeSource => typesSource.some((x) => x.cle === t);

// Libellé court d'une source, toujours avec son année : « ESC 2023 — Insuffisance cardiaque »
export const libelleSource = (s: { titre: string; organisme: string; annee: number | null }) =>
  [[s.organisme, s.annee].filter(Boolean).join(" "), s.titre].filter(Boolean).join(" — ");

// Lien vers la source, ouvert à la page citée (les lecteurs PDF des navigateurs comprennent « #page= »)
export const lienPage = (url: string, page: number | null) =>
  url && page && !url.includes("#") ? `${url}#page=${page}` : url;

// Google Drive du cabinet : les examens (PDF, photos) y sont rangés, un dossier par patient.
// Avec un compte Gmail, un compte de service n'a pas d'espace Drive : le site agit donc au nom du compte Google
// du cabinet, connecté une fois par l'administrateur (OAuth). La portée « drive.file » limite le site aux seuls
// fichiers qu'il a créés. Variables d'environnement : voir DOSSIER.md.

import { base } from "./base";
import { chiffrer, dechiffrer } from "./chiffrement";
import { ecrireParametre, lireParametre } from "./parametres";

const API = "https://www.googleapis.com/drive/v3";
const ENVOI = "https://www.googleapis.com/upload/drive/v3/files";
const JETON = "https://oauth2.googleapis.com/token";
export const PORTEES = "https://www.googleapis.com/auth/drive.file openid email";

const DOSSIER = "application/vnd.google-apps.folder";
const NOM_RACINE = "Cabinet — Dossiers patients";

const config = () => ({
  client: process.env.GOOGLE_OAUTH_CLIENT_ID,
  secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
});

export const driveConfigure = () => {
  const { client, secret } = config();
  return Boolean(client && secret);
};

export const urlConsentement = (retour: string, etat: string) =>
  `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: config().client!,
    redirect_uri: retour,
    response_type: "code",
    scope: PORTEES,
    access_type: "offline",
    prompt: "consent", // pour recevoir à chaque fois un jeton de rafraîchissement
    state: etat,
  })}`;

// --- Erreurs de Google, traduites en consignes pour le cabinet ---

// Garde le code HTTP et les raisons données par Google (« accessNotConfigured », « invalid_grant »…)
export class ErreurDrive extends Error {
  constructor(
    readonly statut: number,
    readonly raisons: string[],
    message: string,
  ) {
    super(message);
  }
}

type CorpsErreur = {
  error?: string | { message?: string; status?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] };
  error_description?: string;
};

async function erreurGoogle(reponse: Response, contexte: string) {
  const corps = (await reponse.json().catch(() => null)) as CorpsErreur | null;
  const e = corps?.error;
  const raisons =
    typeof e === "string"
      ? [e]
      : [...(e?.errors ?? []), ...(e?.details ?? [])].map((x) => x.reason ?? "").concat(e?.status ?? "").filter(Boolean);
  const detail = typeof e === "string" ? corps?.error_description : e?.message;
  return new ErreurDrive(reponse.status, raisons, `${contexte} : erreur ${reponse.status} ${raisons.join(", ")} ${detail ?? ""}`);
}

// Message affiché au personnel quand un envoi échoue
export function expliquerErreurDrive(erreur: unknown) {
  if (!(erreur instanceof ErreurDrive)) return "Google Drive ne répond pas. Réessayez dans un instant.";
  const a = (...raisons: string[]) => raisons.some((r) => erreur.raisons.includes(r));
  if (a("invalid_grant")) {
    return "L'accès à Google Drive a expiré ou a été retiré : l'administrateur doit reconnecter Google Drive (page Google Drive de l'espace cabinet).";
  }
  if (a("invalid_client", "unauthorized_client")) {
    return "Les identifiants OAuth Google enregistrés sur Vercel ne sont pas valides (voir DOSSIER.md).";
  }
  if (a("accessNotConfigured", "SERVICE_DISABLED")) {
    return "L'API Google Drive n'est pas activée : console.cloud.google.com → API et services → Bibliothèque → Google Drive API → Activer, puis réessayer quelques minutes plus tard.";
  }
  if (a("insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
    return "Google n'a pas donné l'accès aux fichiers : l'administrateur doit reconnecter Google Drive en cochant la case d'accès à Google Drive.";
  }
  if (a("storageQuotaExceeded")) return "Le Google Drive du cabinet est plein.";
  if (erreur.statut === 429 || erreur.statut >= 500) return "Google Drive est momentanément indisponible. Réessayez dans un instant.";
  return `Google Drive a refusé l'envoi (erreur ${erreur.statut}${erreur.raisons.length ? ` ${erreur.raisons[0]}` : ""}).`;
}

// --- Connexion du compte Google du cabinet ---

export async function compteDrive() {
  const brut = await lireParametre("drive");
  return brut ? (JSON.parse(brut) as { email: string; connecteLe: string; par: string }) : null;
}

// Échange le code reçu après le consentement contre un jeton de rafraîchissement, et l'enregistre chiffré
export async function connecterDrive(code: string, retour: string, par: string) {
  const { client, secret } = config();
  const reponse = await fetch(JETON, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client!,
      client_secret: secret!,
      redirect_uri: retour,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!reponse.ok) throw await erreurGoogle(reponse, "Google a refusé la connexion");
  const { refresh_token, id_token, scope } = (await reponse.json()) as {
    refresh_token?: string;
    id_token?: string;
    scope?: string;
  };
  if (!refresh_token) throw new Error("Google n'a pas fourni de jeton de rafraîchissement");
  // Google laisse décocher l'accès à Drive sur la page de consentement : le site ne pourrait alors rien enregistrer
  if (!scope?.split(" ").includes("https://www.googleapis.com/auth/drive.file")) {
    throw new ErreurDrive(403, ["portee"], "L'accès à Google Drive n'a pas été autorisé");
  }
  // Le jeton d'identité vient directement de Google (HTTPS) : il suffit d'en lire l'adresse
  const email = id_token
    ? ((JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString()) as { email?: string }).email ?? "")
    : "";

  await ecrireParametre("drive_jeton", chiffrer(refresh_token));
  await ecrireParametre("drive", JSON.stringify({ email, connecteLe: new Date().toISOString(), par }));
  jeton = null;
}

export async function deconnecterDrive() {
  const brut = await lireParametre("drive_jeton");
  if (brut) {
    // Révoque l'accès chez Google ; sans effet si le jeton était déjà invalide
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(dechiffrer(brut))}`, {
      method: "POST",
      cache: "no-store",
    }).catch(console.error);
  }
  await ecrireParametre("drive_jeton", null);
  await ecrireParametre("drive", null);
  jeton = null;
}

let jeton: { valeur: string; expire: number } | null = null;

async function jetonAcces() {
  if (jeton && jeton.expire > Date.now() + 60_000) return jeton.valeur;
  const brut = await lireParametre("drive_jeton");
  if (!brut) throw new Error("Google Drive n'est pas connecté");
  const { client, secret } = config();
  const reponse = await fetch(JETON, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client!,
      client_secret: secret!,
      refresh_token: dechiffrer(brut),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!reponse.ok) throw await erreurGoogle(reponse, "Accès Google Drive refusé");
  const { access_token, expires_in } = (await reponse.json()) as { access_token: string; expires_in: number };
  jeton = { valeur: access_token, expire: Date.now() + expires_in * 1000 };
  return access_token;
}

async function appel(url: string, init: RequestInit = {}) {
  const reponse = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await jetonAcces()}`, ...init.headers },
    cache: "no-store",
  });
  if (!reponse.ok) throw await erreurGoogle(reponse, "Google Drive");
  return reponse;
}

async function creerDossier(nom: string, parent?: string) {
  const reponse = await appel(`${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nom, mimeType: DOSSIER, parents: parent ? [parent] : undefined }),
  });
  return ((await reponse.json()) as { id: string }).id;
}

// Les noms de fichiers ne doivent pas contenir de « / » ni de caractères de contrôle
const nomPropre = (nom: string) =>
  nom
    .replace(/[\u0000-\u001f/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

// Dossier racine du cabinet, créé au premier examen
async function racineDrive(recreer = false) {
  const racine = recreer ? null : await lireParametre("drive_racine");
  if (racine) return racine;
  const id = await creerDossier(NOM_RACINE);
  await ecrireParametre("drive_racine", id);
  return id;
}

const introuvable = (e: unknown) => e instanceof ErreurDrive && e.statut === 404;

// Dossier Drive du patient, créé au premier examen (dans le dossier racine du cabinet)
async function dossierPatient(patient: { id: number; nom: string; prenom: string }, recreer = false) {
  const sql = await base();
  if (!recreer) {
    const [ligne] = await sql`SELECT drive_dossier FROM patients WHERE id = ${patient.id}`;
    if (ligne?.drive_dossier) return ligne.drive_dossier as string;
  }
  const nom = nomPropre(`${patient.nom.toUpperCase()} ${patient.prenom} — n° ${patient.id}`);
  const id = await creerDossier(nom, await racineDrive()).catch(async (e) => {
    // Dossier racine mis à la corbeille, ou créé avec un autre compte Google : on en crée un nouveau
    if (!introuvable(e)) throw e;
    return creerDossier(nom, await racineDrive(true));
  });
  await sql`UPDATE patients SET drive_dossier = ${id} WHERE id = ${patient.id}`;
  return id;
}

// Range le fichier dans le dossier du patient ; si ce dossier a disparu du Drive, il est recréé
export async function envoyerExamen(patient: { id: number; nom: string; prenom: string }, nom: string, fichier: Blob) {
  try {
    return await envoyerFichier(await dossierPatient(patient), nom, fichier);
  } catch (e) {
    if (!introuvable(e)) throw e;
    return envoyerFichier(await dossierPatient(patient, true), nom, fichier);
  }
}

async function envoyerFichier(dossier: string, nom: string, fichier: Blob) {
  const limite = `limite-${crypto.randomUUID()}`;
  const metadonnees = JSON.stringify({ name: nomPropre(nom), parents: [dossier] });
  const corps = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadonnees}\r\n`,
    `--${limite}\r\nContent-Type: ${fichier.type || "application/octet-stream"}\r\n\r\n`,
    fichier,
    `\r\n--${limite}--`,
  ]);
  const reponse = await appel(`${ENVOI}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${limite}` },
    body: corps,
  });
  return ((await reponse.json()) as { id: string }).id;
}

// Contenu du fichier, transmis tel quel au navigateur
export async function lireFichier(id: string) {
  return appel(`${API}/files/${encodeURIComponent(id)}?alt=media`);
}

// Corbeille Drive : récupérable pendant 30 jours en cas d'erreur
export async function mettreALaCorbeille(id: string) {
  await appel(`${API}/files/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}

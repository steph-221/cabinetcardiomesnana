// Connexion à l'espace cabinet.
// - Le compte administrateur (le médecin) est défini sur Vercel : COMPTE_ADMIN=taouab:motdepasse
// - L'administrateur crée lui-même les autres comptes (secrétaire, remplaçant…) depuis le site ;
//   ils sont enregistrés dans le stockage, mots de passe chiffrés (scrypt).
// - Chaque compte a un rôle : « medecin » (remplaçant : tout le dossier médical, sauf la gestion des comptes)
//   ou « secretaire » (agenda, identité des patients, examens à classer ; pas le contenu médical).
// La session est un cookie signé avec SESSION_SECRET, valable 12 heures.

import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RoleCompte } from "./roles";
import { commande, stockageConfigure } from "./stockage";

const COOKIE = "espace_cabinet";
const DUREE = 12 * 3600; // secondes
const CLE_COMPTES = "comptes";

export type Utilisateur = { identifiant: string; admin: boolean; role: RoleCompte | "admin" };

// Les comptes créés avant les rôles n'en ont pas : ils restent « secrétaire »
type Compte = {
  empreinte: string;
  sel: string;
  version: string;
  creePar: string;
  creeLe: string;
  role?: RoleCompte;
};

const deriver = promisify(scrypt) as (motDePasse: string, sel: string, longueur: number) => Promise<Buffer>;

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum)");
  return s;
};

const sha256 = (texte: string) => createHash("sha256").update(texte).digest();
const signer = (contenu: string) => createHmac("sha256", secret()).update(contenu).digest("base64url");
const normaliser = (identifiant: string) => identifiant.trim().toLowerCase();

function admin() {
  const valeur = process.env.COMPTE_ADMIN ?? "";
  const i = valeur.indexOf(":");
  if (i < 1) return null;
  return { identifiant: normaliser(valeur.slice(0, i)), motDePasse: valeur.slice(i + 1) };
}

async function lireCompte(identifiant: string) {
  if (!stockageConfigure()) return null;
  const brut = await commande<string | null>("HGET", CLE_COMPTES, identifiant);
  return brut ? (JSON.parse(brut) as Compte) : null;
}

// Vérifie l'identifiant et le mot de passe ; renvoie l'utilisateur reconnu et la version de son compte
export async function verifierIdentifiants(saisi: string, motDePasse: string) {
  const identifiant = normaliser(saisi);
  const a = admin();
  if (a && identifiant === a.identifiant) {
    return timingSafeEqual(sha256(a.motDePasse), sha256(motDePasse)) ? { identifiant, version: "admin" } : null;
  }
  const compte = await lireCompte(identifiant);
  // Calcule toujours une empreinte, même si le compte n'existe pas, pour ne pas révéler les identifiants valides
  const calcule = await deriver(motDePasse, compte?.sel ?? "sel-inconnu", 32);
  if (!compte) return null;
  return timingSafeEqual(calcule, Buffer.from(compte.empreinte, "base64")) ? { identifiant, version: compte.version } : null;
}

export async function ouvrirSession({ identifiant, version }: { identifiant: string; version: string }) {
  const contenu = Buffer.from(
    JSON.stringify({ u: identifiant, v: version, exp: Math.floor(Date.now() / 1000) + DUREE }),
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${contenu}.${signer(contenu)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE,
  });
}

export async function fermerSession() {
  (await cookies()).delete(COOKIE);
}

// Personne connectée, ou null
export async function utilisateurConnecte(): Promise<Utilisateur | null> {
  const valeur = (await cookies()).get(COOKIE)?.value;
  if (!valeur) return null;
  const [contenu, signature] = valeur.split(".");
  if (!contenu || !signature) return null;
  const attendue = Buffer.from(signer(contenu));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return null;

  let session: { u: string; v: string; exp: number };
  try {
    session = JSON.parse(Buffer.from(contenu, "base64url").toString());
  } catch {
    return null;
  }
  if (session.exp < Date.now() / 1000) return null;
  if (session.u === admin()?.identifiant) return { identifiant: session.u, admin: true, role: "admin" };
  // Un compte supprimé ou dont le mot de passe a été changé perd l'accès immédiatement
  const compte = await lireCompte(session.u);
  return compte?.version === session.v
    ? { identifiant: session.u, admin: false, role: compte.role ?? "secretaire" }
    : null;
}

// Le contenu médical (antécédents, traitements, conclusions…) est réservé aux médecins
export const accesMedical = (utilisateur: Utilisateur) => utilisateur.role !== "secretaire";

// Pour les pages et les actions : renvoie vers la connexion, ou vers l'accueil de l'espace si le rôle ne suffit pas.
// Les actions doivent toujours l'appeler elles-mêmes : ne jamais se fier à la page qui les appelle.
export async function exigerUtilisateur(langue: string, acces: "tous" | "medical" | "admin" = "tous") {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect(`/${langue}/espace/connexion`);
  if ((acces === "medical" && !accesMedical(utilisateur)) || (acces === "admin" && !utilisateur.admin)) {
    redirect(`/${langue}/espace`);
  }
  return utilisateur;
}

// --- Gestion des comptes (réservée à l'administrateur : à vérifier par l'appelant) ---

export async function listerComptes() {
  const brut = await commande<string[]>("HGETALL", CLE_COMPTES);
  const comptes: { identifiant: string; creePar: string; creeLe: string; role: RoleCompte }[] = [];
  for (let i = 0; i < brut.length; i += 2) {
    const { creePar, creeLe, role } = JSON.parse(brut[i + 1]) as Compte;
    comptes.push({ identifiant: brut[i], creePar, creeLe, role: role ?? "secretaire" });
  }
  return comptes.sort((a, b) => a.identifiant.localeCompare(b.identifiant));
}

export const identifiantValide = (identifiant: string) => /^[a-z0-9._-]{2,30}$/.test(identifiant);

// Crée le compte, ou remplace son mot de passe s'il existe (ses sessions ouvertes sont alors fermées)
export async function enregistrerCompte(saisi: string, motDePasse: string, par: string, role: RoleCompte) {
  const identifiant = normaliser(saisi);
  const sel = randomBytes(16).toString("base64");
  const compte: Compte = {
    empreinte: (await deriver(motDePasse, sel, 32)).toString("base64"),
    sel,
    version: randomBytes(8).toString("base64url"),
    creePar: par,
    creeLe: new Date().toISOString(),
    role,
  };
  await commande("HSET", CLE_COMPTES, identifiant, JSON.stringify(compte));
}

// Change le rôle sans toucher au mot de passe ; les sessions ouvertes prennent le nouveau rôle à la requête suivante
export async function changerRole(saisi: string, role: RoleCompte) {
  const identifiant = normaliser(saisi);
  const compte = await lireCompte(identifiant);
  if (!compte) return;
  await commande("HSET", CLE_COMPTES, identifiant, JSON.stringify({ ...compte, role }));
}

export async function supprimerCompte(identifiant: string) {
  await commande("HDEL", CLE_COMPTES, normaliser(identifiant));
}

export const estAdmin = (identifiant: string) => normaliser(identifiant) === admin()?.identifiant;

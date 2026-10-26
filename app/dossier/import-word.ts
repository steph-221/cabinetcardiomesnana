// Reprise des comptes rendus Word : extraction par Claude du contenu médical (texte masqué, sans identité), puis
// enregistrement de la proposition jusqu'à sa validation par le médecin, qui crée ou complète le dossier.

import Anthropic from "@anthropic-ai/sdk";
import type { BetaTextBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { base } from "./base";
import { champsETT } from "./ett";
import { bornes, mesures, type CleMesure } from "./mesures";
import { facteursRisque } from "./patients";
import type { IdentiteLue } from "./reprise";
import { glossaire } from "./vocabulaire";

export type VisiteLue = {
  date: string | null;
  motif: string;
  taSys: number | null;
  taDia: number | null;
  fc: number | null;
  spo2: number | null;
  poids: number | null;
  taille: number | null;
  examen: string;
  ecg: string;
  autres: string;
  conclusion: string;
  conduite: string;
  mesures: Partial<Record<CleMesure, number>>;
};

export type EttLue = {
  date: string | null;
  indication: string;
  operateur: string;
  valeurs: Record<string, string | number>;
  total: string;
};

export type Proposition = {
  type: "consultation" | "ett" | "autre";
  sexe: "" | "F" | "M";
  antecedents: string;
  facteursRisque: string[];
  allergies: string;
  inrMin: number | null;
  inrMax: number | null;
  traitements: { medicament: string; posologie: string; arrete: boolean }[];
  visites: VisiteLue[];
  ett: EttLue | null;
  aVerifier: string[];
};

export type Import = {
  id: number;
  nomFichier: string;
  texte: string;
  identite: IdentiteLue;
  proposition: Proposition | null;
  statut: "a_valider" | "importe" | "ignore";
  patientId: number | null;
  creeLe: Date;
  creePar: string;
};

// --- Extraction par Claude ---

const nombreOuRien = { anyOf: [{ type: "number" }, { type: "null" }] };
const texteOuRien = { anyOf: [{ type: "string" }, { type: "null" }] };
const clesVisite = ["taSys", "taDia", "fc", "spo2", "poids", "taille", ...mesures.map((m) => m.cle)];
const textesVisite = ["motif", "examen", "ecg", "autres", "conclusion", "conduite"];
const objet = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const schema = objet({
  type: { type: "string", enum: ["consultation", "ett", "autre"] },
  sexe: { type: "string", enum: ["", "F", "M"] },
  antecedents: { type: "string" },
  facteursRisque: { type: "array", items: { type: "string", enum: [...facteursRisque] } },
  allergies: { type: "string" },
  inrMin: nombreOuRien,
  inrMax: nombreOuRien,
  traitements: {
    type: "array",
    items: objet({ medicament: { type: "string" }, posologie: { type: "string" }, arrete: { type: "boolean" } }),
  },
  visites: {
    type: "array",
    items: objet({
      date: texteOuRien,
      ...Object.fromEntries(textesVisite.map((c) => [c, { type: "string" }])),
      ...Object.fromEntries(clesVisite.map((c) => [c, nombreOuRien])),
    }),
  },
  ett: {
    anyOf: [
      { type: "null" },
      objet({
        date: texteOuRien,
        indication: { type: "string" },
        operateur: { type: "string" },
        total: { type: "string" },
        valeurs: objet(Object.fromEntries(champsETT.map((c) => [c.cle, c.texte ? { type: "string" } : nombreOuRien]))),
      }),
    ],
  },
  aVerifier: { type: "array", items: { type: "string" } },
});

const CONSIGNES = `Tu reprends les anciens comptes rendus Word d'un cabinet de cardiologie au Maroc pour remplir le dossier médical informatisé. Le nom du patient, sa date de naissance et ses téléphones ont été remplacés par [PATIENT], [NAISSANCE] et [TÉLÉPHONE].

Deux modèles existent :
- le « rapport de consultation » : un tableau d'en-tête (antécédents et FDRCV, motif, examen physique avec TA, FC, SpO2, taille, poids, ECG, autres, ETT, conclusion) daté en haut du document ; puis les visites suivantes ajoutées à la suite en texte libre, chacune commençant par sa date ;
- le « compte rendu d'échocardiographie-Doppler » (ETT) : mesures 2D, Doppler et « AU TOTAL ».

Règles :
1. Recopie fidèlement ; n'invente rien. Une information absente reste vide ("" ou null). Ne déduis pas de diagnostic.
2. visites : une entrée par visite datée, dans l'ordre du document, la première étant celle du tableau d'en-tête. Dates au format AAAA-MM-JJ (« 02/12/24 » → « 2024-12-02 »). Range chaque phrase dans la rubrique qui convient : motif (plaintes, raison de la venue), examen (examen clinique), ecg, autres (biologie, INR, résultats d'examens comme l'ETT ou le Holter), conclusion, conduite (traitement, modifications de dose, examens prévus, prochain rendez-vous).
3. Valeurs chiffrées d'une visite : taSys/taDia en mmHg, fc en bpm, spo2 en %, poids en kg, taille en cm, inr sans unité, fevg en %, ldl en g/L, creatinine en mg/L, hba1c en %, ntprobnp en pg/mL. Une valeur dans une autre unité reste null (et reste dans le texte). Une valeur vide dans le modèle (« SPO2 : % ») est null.
4. antecedents : antécédents et FDRCV tels qu'écrits. facteursRisque : seulement ceux écrits explicitement, parmi la liste. allergies : seulement si elles sont écrites. inrMin/inrMax : seulement si une zone cible d'INR est écrite.
5. traitements : les médicaments cités comme pris par le patient (nom tel qu'écrit, orthographe corrigée : « sintrom » → « Sintrom »), avec la posologie la plus récente ; arrete = true s'il est écrit qu'il est arrêté (« Stop cardix »).
6. ett : seulement pour un compte rendu d'échocardiographie (sinon null). Recopie chaque mesure dans le champ correspondant (une mesure vide dans le modèle, comme « TAPSE = mm », est null) ; les descriptions (valves, VD, cinétique, péricarde, VCI) en texte court ; total = le texte du « AU TOTAL », ligne par ligne. Pour un rapport de consultation, les phrases sur l'ETT vont dans « autres » de la visite (et fevg dans les valeurs).
7. sexe : seulement si le texte l'indique (« Mme », « patiente », « né », « née », accords) ; sinon "".
8. Corrige les fautes de frappe évidentes (« Gradietn » → « Gradient », « Hypokiénsie » → « Hypokinésie », « Vertifes » → « Vertiges »).
9. aVerifier : en phrases courtes, ce que le médecin doit vérifier : date illisible, valeur douteuse, mot incompris, posologie ambiguë.

Glossaire :
${glossaire}`;

let client: Anthropic | null = null;

// Garde les nombres plausibles ; une valeur hors bornes passe dans « à vérifier »
function borne(v: unknown, cle: string, min: number | undefined, max: number | undefined, aVerifier: string[]) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if ((min !== undefined && v < min) || (max !== undefined && v > max)) {
    aVerifier.push(`Valeur écartée car invraisemblable : ${cle} = ${v}`);
    return null;
  }
  return v;
}

const jourValide = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

export function nettoyerProposition(brut: Record<string, unknown>): Proposition {
  const aVerifier = Array.isArray(brut.aVerifier) ? brut.aVerifier.filter((t) => typeof t === "string") : [];
  const texte = (v: unknown, n = 5000) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const visites = (Array.isArray(brut.visites) ? brut.visites : []).slice(0, 100).map((v: Record<string, unknown>) => {
    const visite: VisiteLue = {
      date: jourValide(v.date),
      motif: texte(v.motif),
      examen: texte(v.examen),
      ecg: texte(v.ecg),
      autres: texte(v.autres),
      conclusion: texte(v.conclusion),
      conduite: texte(v.conduite),
      taSys: null,
      taDia: null,
      fc: null,
      spo2: null,
      poids: null,
      taille: null,
      mesures: {},
    };
    for (const c of ["taSys", "taDia", "fc", "spo2", "poids", "taille"] as const) {
      visite[c] = borne(v[c], c, bornes[c][0], bornes[c][1], aVerifier);
    }
    for (const m of mesures) {
      const n = borne(v[m.cle], m.libelle, m.min, m.max, aVerifier);
      if (n !== null) visite.mesures[m.cle] = n;
    }
    if (!visite.date) aVerifier.push("Une visite n'a pas de date lisible : indiquez-la ou décochez-la.");
    return visite;
  });
  let ett: EttLue | null = null;
  if (brut.ett && typeof brut.ett === "object") {
    const e = brut.ett as Record<string, unknown>;
    const lues = (e.valeurs ?? {}) as Record<string, unknown>;
    const valeurs: Record<string, string | number> = {};
    for (const c of champsETT) {
      if (c.texte) {
        const t = texte(lues[c.cle], 300);
        if (t) valeurs[c.cle] = t;
      } else {
        const n = borne(lues[c.cle], c.libelle, c.min, c.max, aVerifier);
        if (n !== null) valeurs[c.cle] = n;
      }
    }
    ett = {
      date: jourValide(e.date),
      indication: texte(e.indication, 300),
      operateur: texte(e.operateur, 100),
      valeurs,
      total: texte(e.total),
    };
  }
  const fdr = Array.isArray(brut.facteursRisque) ? brut.facteursRisque : [];
  const inr = (v: unknown) => (typeof v === "number" && v >= 1 && v <= 5 ? v : null);
  return {
    type: brut.type === "ett" || brut.type === "consultation" ? brut.type : "autre",
    sexe: brut.sexe === "F" || brut.sexe === "M" ? brut.sexe : "",
    antecedents: texte(brut.antecedents),
    facteursRisque: facteursRisque.filter((f) => fdr.includes(f)),
    allergies: texte(brut.allergies, 1000),
    inrMin: inr(brut.inrMin),
    inrMax: inr(brut.inrMax),
    traitements: (Array.isArray(brut.traitements) ? brut.traitements : [])
      .slice(0, 40)
      .map((t: Record<string, unknown>) => ({
        medicament: texte(t.medicament, 150),
        posologie: texte(t.posologie, 300),
        arrete: t.arrete === true,
      }))
      .filter((t) => t.medicament),
    visites,
    ett,
    aVerifier: [...new Set(aVerifier)].slice(0, 30),
  };
}

export async function extraire(texteMasque: string): Promise<Proposition> {
  client ??= new Anthropic();
  const reponse = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // Si un filtre de sécurité refuse la demande à tort, l'API la relance sur le modèle de repli recommandé
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: [{ type: "text", text: CONSIGNES, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Compte rendu :\n\n${texteMasque}` }],
  });
  const texte = reponse.content.find((b): b is BetaTextBlock => b.type === "text")?.text ?? "{}";
  return nettoyerProposition(JSON.parse(texte));
}

// Proposition vide (sans clé Anthropic) : le médecin remplit lui-même le formulaire de validation
export const propositionVide = (identite: IdentiteLue): Proposition => ({
  type: "autre",
  sexe: "",
  antecedents: "",
  facteursRisque: [],
  allergies: "",
  inrMin: null,
  inrMax: null,
  traitements: [],
  visites: identite.dateDocument
    ? [
        {
          date: identite.dateDocument,
          motif: "",
          taSys: null,
          taDia: null,
          fc: null,
          spo2: null,
          poids: null,
          taille: null,
          examen: "",
          ecg: "",
          autres: "",
          conclusion: "",
          conduite: "",
          mesures: {},
        },
      ]
    : [],
  ett: null,
  aVerifier: ["Lecture automatique non disponible (clé Anthropic absente) : remplissez le dossier d'après le texte."],
});

// --- Enregistrement ---

const versImport = (l: Record<string, unknown>): Import => ({
  id: l.id as number,
  nomFichier: l.nom_fichier as string,
  texte: l.texte as string,
  identite: l.identite as IdentiteLue,
  proposition: l.proposition as Proposition | null,
  statut: l.statut as Import["statut"],
  patientId: l.patient_id as number | null,
  creeLe: l.cree_le as Date,
  creePar: l.cree_par as string,
});

export async function enregistrerImport(
  i: Pick<Import, "nomFichier" | "texte" | "identite" | "proposition">,
  par: string,
) {
  const sql = await base();
  const [ligne] = await sql`
    INSERT INTO imports (nom_fichier, texte, identite, proposition, cree_par)
    VALUES (${i.nomFichier}, ${i.texte}, ${JSON.stringify(i.identite)}::jsonb, ${JSON.stringify(i.proposition)}::jsonb, ${par})
    RETURNING id`;
  return ligne.id as number;
}

export async function listerImports() {
  const sql = await base();
  const lignes = await sql`
    SELECT id, nom_fichier, '' AS texte, identite, NULL AS proposition, statut, patient_id, cree_le, cree_par
    FROM imports ORDER BY statut <> 'a_valider', cree_le DESC LIMIT 300`;
  return lignes.map(versImport);
}

export async function lireImport(id: number) {
  const sql = await base();
  const [ligne] = await sql`SELECT * FROM imports WHERE id = ${id}`;
  return ligne ? versImport(ligne) : null;
}

export async function cloreImport(id: number, statut: "importe" | "ignore", patientId: number | null, par: string) {
  const sql = await base();
  const [ligne] = await sql`
    UPDATE imports SET statut = ${statut}, patient_id = ${patientId}, traite_le = now(), traite_par = ${par}
    WHERE id = ${id} AND statut = 'a_valider' RETURNING id`;
  return Boolean(ligne);
}

export async function supprimerImport(id: number) {
  const sql = await base();
  await sql`DELETE FROM imports WHERE id = ${id}`;
}

// Après validation : le dossier créé ou complété ; en cas d'échec, l'import redevient « à valider »
export async function lierPatient(id: number, patientId: number) {
  const sql = await base();
  await sql`UPDATE imports SET patient_id = ${patientId} WHERE id = ${id}`;
}

export async function rouvrirImport(id: number) {
  const sql = await base();
  await sql`UPDATE imports SET statut = 'a_valider', patient_id = NULL, traite_le = NULL, traite_par = NULL WHERE id = ${id}`;
}

// Un même fichier déjà lu n'est pas relu (ni refacturé)
export async function importExistant(nomFichier: string, texte: string) {
  const sql = await base();
  const [ligne] = await sql`SELECT id FROM imports WHERE nom_fichier = ${nomFichier} AND texte = ${texte} LIMIT 1`;
  return (ligne?.id as number | undefined) ?? null;
}

// Traitements repris : ceux qui sont arrêtés le sont à la date de la dernière visite
export async function ajouterTraitementsRepris(
  patientId: number,
  lignes: { medicament: string; posologie: string; fin: string | null }[],
  par: string,
) {
  if (!lignes.length) return;
  const sql = await base();
  await sql`
    INSERT INTO traitements (patient_id, medicament, posologie, fin, cree_par)
    SELECT ${patientId}, t.medicament, t.posologie, t.fin, ${par}
    FROM jsonb_to_recordset(${JSON.stringify(lignes)}::jsonb) AS t(medicament text, posologie text, fin date)`;
}

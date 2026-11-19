// Amélioration facultative de la dictée par Claude (Anthropic) : correction des termes et rangement par rubrique,
// avec le vocabulaire de cardiologie et le lexique du cabinet. La reconnaissance vocale se fait dans le navigateur,
// et une première correction gratuite y est déjà appliquée (correction-locale.ts). Clé : ANTHROPIC_API_KEY.

import { rubriques, type Correction } from "./correction-locale";
import { appelerIA } from "./ia/appel";
import { bornes, bornesConstantes, mesures, type Constantes } from "./mesures";
import { glossaire } from "./vocabulaire";

export const claudeConfigure = () => Boolean(process.env.ANTHROPIC_API_KEY);

const champsChiffres = [...(Object.keys(bornesConstantes) as (keyof Constantes)[]), ...mesures.map((m) => m.cle)];

const nombreOuRien = { anyOf: [{ type: "number" }, { type: "null" }] };
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["rubriques", "valeurs", "incertains"],
  properties: {
    rubriques: {
      type: "object",
      additionalProperties: false,
      required: [...rubriques],
      properties: Object.fromEntries(rubriques.map((r) => [r, { type: "string" }])),
    },
    valeurs: {
      type: "object",
      additionalProperties: false,
      required: champsChiffres,
      properties: Object.fromEntries(champsChiffres.map((c) => [c, nombreOuRien])),
    },
    incertains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["entendu", "propose"],
        properties: { entendu: { type: "string" }, propose: { type: "string" } },
      },
    },
  },
};

// Consignes fixes (mises en cache par l'API) ; le lexique du cabinet et la dictée viennent ensuite
const CONSIGNES = `Tu mets au propre la dictée d'un cardiologue, transcrite automatiquement par la reconnaissance vocale du navigateur (souvent sans ponctuation), pour remplir un rapport de consultation de cardiologie en français.

Règles :
1. Corrige les erreurs de reconnaissance (mots déformés, homophones, sigles mal compris) à l'aide du glossaire et du lexique du cabinet. Exemples : « bi soprolol » → « bisoprolol », « ache vé gé » → « HVG », « sin trom » → « Sintrom ».
2. N'ajoute JAMAIS d'information qui n'a pas été dictée : aucun diagnostic, examen, traitement, posologie ni valeur. Ne complète pas, ne résume pas, ne reformule pas le sens. Si tu hésites sur un mot, garde la forme la plus probable et signale-le dans « incertains » (entendu = ce que dit la transcription, propose = ta correction).
3. Commandes dictées : « à la ligne » ou « nouvelle ligne » = retour à la ligne ; « point », « virgule », « deux points » = ponctuation ; « motif », « examen », « ECG » ou « électrocardiogramme », « échographie » ou « écho cardiaque », « autres », « conclusion », « conduite à tenir » prononcés en début de phrase (éventuellement précédés de « rubrique ») = changement de rubrique. Ne recopie pas les commandes elles-mêmes.
4. Rubriques : motif (motif de consultation), examen (examen clinique), ecg (électrocardiogramme), echo (échographie cardiaque), autres (biologie et autres résultats), conclusion, conduite (conduite à tenir, traitement, prochain rendez-vous). Sans rubrique annoncée, range chaque phrase dans la rubrique qui correspond à son contenu. Une rubrique non dictée reste vide.
5. Valeurs chiffrées : quand une valeur est dictée, recopie-la aussi dans « valeurs », en chiffres. Unités attendues : taSys et taDia en mmHg (« 13/8 » ou « treize huit » signifie 130/80 mmHg), fc en bpm, spo2 en %, poids en kg, taille en cm, inr sans unité, fevg en %, ldl en g/L, creatinine en mg/L, hba1c en %, hemoglobine en g/dL, ntprobnp en pg/mL. Si l'unité dictée est différente (mmol/L, µmol/L…), ne convertis pas : laisse la valeur à null et garde-la dans le texte. Une valeur non dictée est null.
6. Écris les sigles comme dans le glossaire (FEVG, HVG, ETT, AVK…), les nombres en chiffres (« cinquante-cinq pour cent » → « 55 % ») et les médicaments avec leur orthographe correcte. Style de compte rendu : phrases courtes, sans formule de politesse.

Glossaire :
${glossaire}`;

// Réponse à refaire sur le modèle supérieur : illisible, valeur chiffrée invraisemblable ou trop de mots douteux
function utilisable(texte: string) {
  const c = JSON.parse(texte) as Correction;
  if (!c.rubriques || (c.incertains ?? []).length > 8) return false;
  return Object.entries(c.valeurs ?? {}).every(([cle, v]) => {
    const [min, max] = bornes[cle] ?? [0, -1];
    return v === null || v === undefined || (typeof v === "number" && v >= min && v <= max);
  });
}

async function demander(
  tache: "dictee" | "traduction_patient" | "scribe",
  consignes: string,
  contenu: string,
  superieur: boolean,
  refus: string,
) {
  const reponse = await appelerIA({ tache, consignes, contenu, schema, maxTokens: 8000, controle: utilisable, superieur });
  if (reponse.arret === "refusal") throw new Error(refus);
  if (reponse.arret === "max_tokens") throw new Error("Dictée trop longue pour la correction automatique");
  return verifier(JSON.parse(reponse.texte) as Correction);
}

// `superieur` : « Refaire avec le modèle supérieur », demandé par le médecin après une première correction
export async function corriger(
  transcription: string,
  lexique: { entendu: string; correct: string }[],
  superieur = false,
) {
  return demander(
    "dictee",
    CONSIGNES,
    [
      lexique.length
        ? `Lexique du cabinet (forme entendue → forme correcte) :\n${lexique.map((l) => `- ${l.entendu} → ${l.correct}`).join("\n")}`
        : "Lexique du cabinet : vide.",
      `Transcription de la dictée :\n${transcription}`,
    ].join("\n\n"),
    superieur,
    "La correction automatique a été refusée",
  );
}

// Parole du patient, transcrite par la reconnaissance vocale (arabe ou français) : rapportée en français dans le
// rapport de consultation, sans rien y ajouter.
const CONSIGNES_PATIENT = `Tu reçois la transcription automatique de ce qu'un patient a dit à son cardiologue pendant la consultation, au Maroc. La transcription est en arabe (souvent en arabe marocain, la darija, parfois mêlé de mots français) ou en français, sans ponctuation et avec des erreurs de reconnaissance.

Rédige en français, pour le rapport de consultation, ce que le patient a rapporté.

Règles :
1. Rapporte fidèlement : symptômes, ancienneté, circonstances, traitements pris ou oubliés, antécédents cités. Style de compte rendu : phrases courtes, à la troisième personne (« Dyspnée d'effort depuis un mois. Dit avoir arrêté son traitement. »).
2. N'ajoute JAMAIS ce qui n'a pas été dit : aucun diagnostic, aucune interprétation, aucun examen, aucun traitement, aucune valeur. Ce n'est pas l'avis du médecin.
3. Rubriques : range les plaintes et leur histoire dans « motif » ; ce que le patient dit de ses résultats d'examens ou d'analyses dans « autres ». Les rubriques « examen », « ecg », « echo », « conclusion » et « conduite » restent vides : elles appartiennent au médecin.
4. Valeurs chiffrées : recopie dans « valeurs » uniquement une valeur clairement énoncée avec son unité habituelle (taSys et taDia en mmHg, fc en bpm, poids en kg, taille en cm, inr, fevg en %, ldl en g/L, creatinine en mg/L, hba1c en %, ntprobnp en pg/mL). Sinon null.
5. Passage inaudible, incohérent ou que tu n'es pas sûr d'avoir compris : ne devine pas. Écris « [passage non compris] » à sa place et signale-le dans « incertains » (entendu = le passage tel que transcrit, propose = ta meilleure lecture en français).
6. Noms de médicaments : écris-les correctement d'après le glossaire, et signale dans « incertains » ceux que tu as dû deviner.

Glossaire :
${glossaire}`;

export async function rapporterPatient(transcription: string, langue: "fr" | "ar", superieur = false) {
  return demander(
    "traduction_patient",
    CONSIGNES_PATIENT,
    `Langue choisie par le médecin pour la reconnaissance : ${langue === "ar" ? "arabe" : "français"}.\n\nTranscription :\n${transcription}`,
    superieur,
    "La mise en français a été refusée",
  );
}

// Ne garde que des valeurs vraisemblables : une valeur hors bornes est retirée (elle reste dans le texte)
function verifier(c: Correction): Correction {
  const valeurs: Correction["valeurs"] = {};
  for (const [cle, v] of Object.entries(c.valeurs ?? {})) {
    const [min, max] = bornes[cle] ?? [0, -1];
    if (typeof v === "number" && v >= min && v <= max) valeurs[cle] = v;
  }
  return {
    rubriques: Object.fromEntries(
      rubriques.map((r) => [r, String(c.rubriques?.[r] ?? "").trim()]),
    ) as Correction["rubriques"],
    valeurs,
    incertains: (c.incertains ?? []).filter((i) => i.entendu && i.propose && i.entendu !== i.propose).slice(0, 20),
  };
}

// Consultation écoutée en entier : le médecin et le patient parlent, la transcription du navigateur ne distingue pas les
// voix. Le modèle range ce qui est dit dans les rubriques du rapport, sans rien ajouter, et signale ce qu'il ne peut
// pas attribuer. Le nom du patient est masqué avant l'envoi ([PATIENT]) ; le médecin relit avant toute insertion.
const CONSIGNES_CONSULTATION = `Tu reçois la transcription automatique d'une consultation de cardiologie au Maroc : le cardiologue et le patient parlent, en français (parfois mêlé de mots arabes), sans ponctuation, sans indication de qui parle, avec des erreurs de reconnaissance. Le nom du patient est remplacé par [PATIENT].

Rédige les rubriques du rapport de consultation, en français, style de compte rendu (phrases courtes).

Règles :
1. N'ajoute JAMAIS ce qui n'a pas été dit : aucun diagnostic, examen, traitement, posologie, valeur ni conduite qui ne soit pas dit par le cardiologue. Ce que dit le patient (symptômes, histoire, traitements pris) va dans « motif », rapporté comme tel (« Dit avoir… », « Se plaint de… »).
2. Les constats et décisions du cardiologue (examen, ECG, résultats commentés, conclusion, traitement, rendez-vous) vont dans « examen », « ecg », « echo », « autres », « conclusion » et « conduite ». Ne mets en « conclusion » ou « conduite » que ce que le cardiologue énonce clairement ; une hypothèse émise à voix haute reste une hypothèse (« À discuter : … »).
3. Quand tu ne peux pas savoir qui a dit quoi, ou quand un passage est inaudible ou incohérent, ne devine pas : écris « [passage non attribué] » ou « [passage non compris] » et signale-le dans « incertains » (entendu = le passage tel que transcrit, propose = ta meilleure lecture).
4. Valeurs chiffrées : recopie dans « valeurs » uniquement celles énoncées clairement avec leur unité (taSys et taDia en mmHg, fc en bpm, spo2 en %, poids en kg, taille en cm, inr, fevg en %, ldl en g/L, creatinine en mg/L, hba1c en %, ntprobnp en pg/mL). Sinon null.
5. Écarte les échanges sans contenu médical (salutations, organisation pratique, bavardage). Corrige l'orthographe des sigles et des médicaments d'après le glossaire.

Glossaire :
${glossaire}`;

export async function rapporterConsultation(transcription: string, superieur = false) {
  return demander(
    "scribe",
    CONSIGNES_CONSULTATION,
    `Transcription de la consultation :\n${transcription}`,
    superieur,
    "La note de consultation a été refusée",
  );
}

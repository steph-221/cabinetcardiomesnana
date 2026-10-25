// Calculs et alertes à partir du dossier. Ce sont des aides : le médecin garde la décision.
// Aucun accès à la base ici, pour pouvoir s'en servir aussi dans le navigateur.

// Surface corporelle (Mosteller), en m²
export function surfaceCorporelle(poids: number | null, taille: number | null) {
  if (!poids || !taille) return null;
  return Math.sqrt((poids * taille) / 3600);
}

// Indice de masse corporelle, en kg/m²
export function imc(poids: number | null, taille: number | null) {
  if (!poids || !taille) return null;
  return poids / (taille / 100) ** 2;
}

// Débit de filtration glomérulaire estimé, CKD-EPI 2021 (sans coefficient ethnique), en mL/min/1,73 m².
// Créatinine en mg/L, l'unité des laboratoires marocains.
export function dfg(creatinineMgL: number | null, age: number | null, sexe: "" | "F" | "M") {
  if (!creatinineMgL || age === null || !sexe) return null;
  const scr = creatinineMgL / 10; // mg/dL
  const femme = sexe === "F";
  const kappa = femme ? 0.7 : 0.9;
  const alpha = femme ? -0.241 : -0.302;
  return (
    142 *
    Math.min(scr / kappa, 1) ** alpha *
    Math.max(scr / kappa, 1) ** -1.2 *
    0.9938 ** age *
    (femme ? 1.012 : 1)
  );
}

// Score CHA₂DS₂-VA des recommandations ESC 2024 sur la fibrillation atriale (le sexe n'y compte plus)
export const criteresCha2ds2va = [
  { cle: "icc", libelle: "Insuffisance cardiaque ou dysfonction VG", points: 1 },
  { cle: "hta", libelle: "Hypertension artérielle", points: 1 },
  { cle: "age75", libelle: "Âge ≥ 75 ans", points: 2 },
  { cle: "diabete", libelle: "Diabète", points: 1 },
  { cle: "avc", libelle: "AVC, AIT ou embolie artérielle", points: 2 },
  { cle: "vasculaire", libelle: "Maladie vasculaire (IDM, artériopathie, plaque aortique)", points: 1 },
  { cle: "age65", libelle: "Âge 65 à 74 ans", points: 1 },
] as const;

export function cha2ds2va(coches: Iterable<string>) {
  const ensemble = new Set(coches);
  return criteresCha2ds2va.reduce((total, c) => total + (ensemble.has(c.cle) ? c.points : 0), 0);
}

// --- Alertes ---

export type Alerte = { niveau: "critique" | "attention"; texte: string };

// Noms usuels (DCI et spécialités) des bêtabloquants, pour l'alerte de bradycardie
const BETABLOQUANTS =
  /bisoprolol|concor|cardensiel|carv[eé]dilol|cardix|kredex|n[eé]bivolol|nebilox|temerit|m[eé]toprolol|seloken|lopressor|at[eé]nolol|t[eé]normine|propranolol|avlocardyl|ac[eé]butolol|sectral|sotalol|sotalex|lab[eé]talol|trandate/i;

type Releve = {
  date: string;
  taSys: number | null;
  taDia: number | null;
  fc: number | null;
  mesures: Partial<Record<string, number>>;
};

const jour = (d: string) => d.split("-").reverse().join("/");
const decimal = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

// Dernière valeur connue d'une mesure (relevés du plus récent au plus ancien), et celle d'avant
function dernieres(releves: Releve[], valeur: (r: Releve) => number | null | undefined) {
  const trouves = releves.flatMap((r) => {
    const v = valeur(r);
    return v === null || v === undefined ? [] : [{ v, date: r.date }];
  });
  return { derniere: trouves[0], precedente: trouves[1] };
}

export function alertes({
  releves,
  traitementsEnCours,
  inrMin,
  inrMax,
  age,
  sexe,
}: {
  releves: Releve[]; // du plus récent au plus ancien
  traitementsEnCours: string[];
  inrMin: number | null;
  inrMax: number | null;
  age: number | null;
  sexe: "" | "F" | "M";
}): Alerte[] {
  const liste: Alerte[] = [];

  const inr = dernieres(releves, (r) => r.mesures.inr).derniere;
  if (inr && inrMin !== null && inrMax !== null && (inr.v < inrMin || inr.v > inrMax)) {
    liste.push({
      niveau: inr.v > inrMax + 1 || inr.v < inrMin - 0.5 ? "critique" : "attention",
      texte: `INR ${decimal(inr.v)} le ${jour(inr.date)} : ${inr.v > inrMax ? "au-dessus" : "en dessous"} de la zone cible ${decimal(inrMin)}–${decimal(inrMax)}`,
    });
  }

  const fc = dernieres(releves, (r) => r.fc).derniere;
  if (fc && fc.v < 50) {
    const bb = traitementsEnCours.filter((t) => BETABLOQUANTS.test(t));
    liste.push({
      niveau: fc.v < 40 ? "critique" : "attention",
      texte: `Bradycardie : FC ${fc.v} bpm le ${jour(fc.date)}${bb.length ? ` sous bêtabloquant (${bb.join(", ")})` : ""}`,
    });
  }

  const ta = releves.find((r) => r.taSys !== null && r.taDia !== null);
  if (ta && (ta.taSys! >= 140 || ta.taDia! >= 90)) {
    liste.push({
      niveau: ta.taSys! >= 180 || ta.taDia! >= 110 ? "critique" : "attention",
      texte: `TA ${ta.taSys}/${ta.taDia} mmHg le ${jour(ta.date)} : au-dessus de 140/90`,
    });
  }

  const creat = dernieres(releves, (r) => r.mesures.creatinine).derniere;
  const debit = creat ? dfg(creat.v, age, sexe) : null;
  if (creat && debit !== null && debit < 60) {
    liste.push({
      niveau: debit < 30 ? "critique" : "attention",
      texte: `DFG estimé ${Math.round(debit)} mL/min/1,73 m² (créatinine ${decimal(creat.v)} mg/L le ${jour(creat.date)}) : adapter les posologies`,
    });
  }

  const { derniere: fevg, precedente: fevgAvant } = dernieres(releves, (r) => r.mesures.fevg);
  if (fevg && fevgAvant && fevgAvant.v - fevg.v >= 10) {
    liste.push({
      niveau: "attention",
      texte: `FEVG en baisse : ${fevg.v} % le ${jour(fevg.date)}, contre ${fevgAvant.v} % le ${jour(fevgAvant.date)}`,
    });
  } else if (fevg && fevg.v <= 40) {
    liste.push({ niveau: "attention", texte: `FEVG altérée : ${fevg.v} % le ${jour(fevg.date)}` });
  }

  return liste;
}

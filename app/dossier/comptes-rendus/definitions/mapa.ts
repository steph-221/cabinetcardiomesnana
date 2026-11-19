import { fr, nombre, texte, type ModeleExamen, type Proposition, type ValeursExamen } from "../types";

// Baisse nocturne de la PA systolique, en % de la PA diurne
export function baisseNocturne(jour: number | null, nuit: number | null) {
  return jour && nuit !== null ? ((jour - nuit) / jour) * 100 : null;
}

export const profil = (baisse: number) =>
  baisse < 0 ? "riser (PA nocturne supérieure à la PA diurne)" : baisse < 10 ? "non-dipper" : baisse <= 20 ? "dipper" : "extrême dipper";

// Valeurs ambulatoires élevées : 24 h ≥ 130/80, jour ≥ 135/85 ou nuit ≥ 120/70 (l'un des trois suffit)
function elevees(v: ValeursExamen) {
  const sup = (sys: string, dia: string, ls: number, ld: number) => {
    const [s, d] = [nombre(v, sys), nombre(v, dia)];
    return (s !== null && s >= ls) || (d !== null && d >= ld);
  };
  return {
    h24: sup("pas24", "pad24", 130, 80),
    jour: sup("pasJour", "padJour", 135, 85),
    nuit: sup("pasNuit", "padNuit", 120, 70),
  };
}

export const mapa: ModeleExamen = {
  cle: "mapa",
  type: "MAPA",
  bouton: "MAPA",
  titre: "MESURE AMBULATOIRE DE LA PRESSION ARTÉRIELLE (MAPA) DES 24 HEURES",
  resume: "PA moyenne sur 24 h, jour et nuit, baisse nocturne, statut tensionnel.",
  sections: [
    {
      titre: "Contexte",
      champs: [
        { cle: "traitement", libelle: "Traitement antihypertenseur", type: "choix", options: ["non traité", "traité"] },
        { cle: "pasConsult", libelle: "PAS de consultation", type: "nombre", unite: "mmHg", min: 70, max: 260 },
        { cle: "padConsult", libelle: "PAD de consultation", type: "nombre", unite: "mmHg", min: 40, max: 160 },
      ],
    },
    {
      titre: "Validité",
      champs: [
        { cle: "duree", libelle: "Durée d'enregistrement", type: "nombre", unite: "h", min: 12, max: 48, exemple: "24" },
        { cle: "nbJour", libelle: "Mesures valides le jour", type: "nombre", min: 0, max: 200 },
        { cle: "nbNuit", libelle: "Mesures valides la nuit", type: "nombre", min: 0, max: 100 },
      ],
    },
    {
      titre: "Pression artérielle moyenne",
      champs: [
        { cle: "pas24", libelle: "PAS sur 24 h", type: "nombre", unite: "mmHg", min: 70, max: 260 },
        { cle: "pad24", libelle: "PAD sur 24 h", type: "nombre", unite: "mmHg", min: 40, max: 160 },
        { cle: "pasJour", libelle: "PAS de jour", type: "nombre", unite: "mmHg", min: 70, max: 260 },
        { cle: "padJour", libelle: "PAD de jour", type: "nombre", unite: "mmHg", min: 40, max: 160 },
        { cle: "pasNuit", libelle: "PAS de nuit", type: "nombre", unite: "mmHg", min: 70, max: 260 },
        { cle: "padNuit", libelle: "PAD de nuit", type: "nombre", unite: "mmHg", min: 40, max: 160 },
        { cle: "fc24", libelle: "Fréquence cardiaque moyenne", type: "nombre", unite: "bpm", min: 30, max: 200 },
        { cle: "chargePas", libelle: "Charge tensionnelle systolique", type: "nombre", unite: "%", min: 0, max: 100 },
        { cle: "chargePad", libelle: "Charge tensionnelle diastolique", type: "nombre", unite: "%", min: 0, max: 100 },
      ],
    },
    {
      titre: "Observations",
      champs: [
        { cle: "symptomes", libelle: "Symptômes pendant l'enregistrement", type: "texte", exemple: "aucun" },
        { cle: "pics", libelle: "Pics tensionnels, hypotension", type: "texte", exemple: "pas d'hypotension" },
      ],
    },
  ],
  calculs(v) {
    const lignes: string[] = [];
    const bs = baisseNocturne(nombre(v, "pasJour"), nombre(v, "pasNuit"));
    const bd = baisseNocturne(nombre(v, "padJour"), nombre(v, "padNuit"));
    if (bs !== null) lignes.push(`Baisse nocturne de la PAS : ${fr(bs, 1)} % (${profil(bs)})`);
    if (bd !== null) lignes.push(`Baisse nocturne de la PAD : ${fr(bd, 1)} %`);
    const [s, d] = [nombre(v, "pas24"), nombre(v, "pad24")];
    if (s !== null && d !== null) lignes.push(`Pression pulsée moyenne sur 24 h : ${fr(s - d)} mmHg`);
    return lignes;
  },
  propositions(v) {
    const p: Proposition[] = [];
    const ajouter = (texte: string, source: string) => p.push({ texte, source });
    const SOURCE = "ESC/ESH 2018 (MAPA)";
    const [nbJour, nbNuit] = [nombre(v, "nbJour"), nombre(v, "nbNuit")];
    if ((nbJour !== null && nbJour < 20) || (nbNuit !== null && nbNuit < 7)) {
      ajouter(
        "Enregistrement de validité insuffisante (au moins 20 mesures diurnes et 7 nocturnes sont attendues) : à interpréter avec prudence ou à refaire.",
        SOURCE,
      );
    }

    const e = elevees(v);
    const mesure = ["pas24", "pad24", "pasJour", "padJour", "pasNuit", "padNuit"].some((k) => nombre(v, k) !== null);
    const [pc, dc] = [nombre(v, "pasConsult"), nombre(v, "padConsult")];
    const consult = pc !== null || dc !== null ? (pc ?? 0) >= 140 || (dc ?? 0) >= 90 : null;
    const ambulatoire = e.h24 || e.jour || e.nuit;
    const traite = texte(v, "traitement") === "traité";
    if (mesure) {
      if (!traite) {
        if (consult === null) {
          ajouter(
            ambulatoire
              ? "Valeurs ambulatoires en faveur d'une hypertension artérielle."
              : "MAPA normale : pas d'hypertension artérielle ambulatoire.",
            SOURCE,
          );
        } else if (consult && ambulatoire) ajouter("Hypertension artérielle confirmée (consultation et MAPA élevées).", SOURCE);
        else if (consult) ajouter("HTA de la blouse blanche (PA de consultation élevée, MAPA normale).", SOURCE);
        else if (ambulatoire) ajouter("HTA masquée (PA de consultation normale, MAPA élevée).", SOURCE);
        else ajouter("Normotension (consultation et MAPA normales).", SOURCE);
      } else if (ambulatoire) {
        ajouter(
          consult === false
            ? "HTA masquée non contrôlée sous traitement."
            : "HTA non contrôlée sous traitement (MAPA élevée).",
          SOURCE,
        );
      } else {
        ajouter(
          consult ? "Effet blouse blanche sous traitement (MAPA normale)." : "HTA contrôlée sous traitement (MAPA normale).",
          SOURCE,
        );
      }
      if (e.nuit && !(e.h24 && e.jour)) ajouter("Hypertension nocturne isolée ou prédominante.", SOURCE);
      else if (e.nuit) ajouter("PA nocturne élevée.", SOURCE);
    }
    const bs = baisseNocturne(nombre(v, "pasJour"), nombre(v, "pasNuit"));
    if (bs !== null) {
      ajouter(
        bs < 10
          ? `Profil ${profil(bs)} (baisse nocturne ${fr(bs, 1)} %) : à discuter, recherche d'un syndrome d'apnées du sommeil, d'une insuffisance rénale ou d'une dysautonomie.`
          : `Profil ${profil(bs)} (baisse nocturne ${fr(bs, 1)} %).`,
        SOURCE,
      );
    }
    return p;
  },
  verification:
    "Seuils MAPA : 24 h ≥ 130/80, jour ≥ 135/85, nuit ≥ 120/70 mmHg ; consultation ≥ 140/90 ; profil dipper 10 à 20 % (ESC/ESH 2018). À relire contre les recommandations avant usage clinique.",
};
